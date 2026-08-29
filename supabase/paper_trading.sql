-- Tape Lounge · 라운지 모의투자 (BTC 무기한 · 격리 마진)
-- 블라인드 차트와 같은 마진 모델(증거금 = 명목가 ÷ 레버리지)을 실시간 시세에 붙인다.
-- 체결가와 청산 판정용 봉은 Edge Function이 Binance에서 받아 넘긴다.
-- 클라이언트가 보낸 가격은 신뢰하지 않는다.

create table if not exists public.paper_accounts (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  wallet       numeric(18,4) not null default 10000 check (wallet >= 0),
  pos          jsonb,
  checked_ms   bigint  not null default 0,   -- 청산 판정을 마친 마지막 봉 시각
  refills      integer not null default 0,   -- 파산 재충전 횟수
  liquidations integer not null default 0,
  peak_equity  numeric(18,4) not null default 10000,
  trades       jsonb   not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.paper_accounts enable row level security;
drop policy if exists paper_self_read on public.paper_accounts;
create policy paper_self_read on public.paper_accounts
  for select to authenticated using (user_id = auth.uid());

revoke all on public.paper_accounts from public, anon, authenticated;
grant select on public.paper_accounts to authenticated;

-- 자금 계산은 전부 여기서만 일어난다.
-- p_action: state | buy | sell | leverage
-- p_bars  : 마지막 판정 이후의 1분봉 [[openMs, high, low], ...] (시각 오름차순)
create or replace function public.paper_apply_internal(
  p_user_id uuid, p_action text, p_pct numeric, p_lev numeric,
  p_price numeric, p_now_ms bigint, p_bars jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v public.paper_accounts%rowtype;
  v_lev numeric;
  v_side text; v_qty numeric; v_entry numeric; v_margin numeric; v_poslev numeric;
  v_liq numeric; v_bar jsonb; v_hi numeric; v_lo numeric; v_ms bigint;
  v_notional numeric := 0; v_fill numeric := 0; v_fee numeric := 0;
  v_want text; v_intent text; v_realized numeric; v_freed numeric;
  v_maxn numeric; v_new_qty numeric; v_new_entry numeric; v_required numeric; v_delta numeric;
  v_equity numeric; v_refilled boolean := false; v_had_pos boolean;
  v_mmr    constant numeric := 0.005;    -- 유지증거금률 0.5%
  v_feerate constant numeric := 0.001;   -- 수수료 0.10%
  v_seed   constant numeric := 10000;
  v_bust   constant numeric := 10;       -- 이 밑으로 떨어지면 파산으로 본다
begin
  if p_action not in ('state','buy','sell','leverage') then raise exception 'INVALID_ACTION'; end if;
  if p_price is null or p_price <= 0 then raise exception 'NO_PRICE'; end if;
  v_lev := floor(coalesce(p_lev, 1));
  if v_lev < 1 or v_lev > 10 then raise exception 'INVALID_ORDER'; end if;

  insert into public.paper_accounts(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into v from public.paper_accounts where user_id = p_user_id for update;

  v_side   := v.pos ->> 'side';
  v_qty    := coalesce((v.pos ->> 'qty')::numeric, 0);
  v_entry  := coalesce((v.pos ->> 'entry')::numeric, 0);
  v_margin := coalesce((v.pos ->> 'margin')::numeric, 0);
  v_poslev := coalesce((v.pos ->> 'lev')::numeric, 1);
  v_had_pos := v_side is not null;

  -- ① 자리를 비운 사이의 봉을 훑어 강제청산을 소급 판정
  if v_side is not null and v_qty > 0 and v_margin > 0 and jsonb_typeof(p_bars) = 'array' then
    v_liq := greatest(0, case when v_side = 'long'
      then v_entry - (v_margin / v_qty - v_mmr * v_entry)
      else v_entry + (v_margin / v_qty - v_mmr * v_entry) end);
    for v_bar in select x from jsonb_array_elements(p_bars) with ordinality a(x, n) order by n loop
      v_ms := (v_bar ->> 0)::bigint;
      if v_ms <= v.checked_ms then continue; end if;
      v_hi := (v_bar ->> 1)::numeric;
      v_lo := (v_bar ->> 2)::numeric;
      v.checked_ms := v_ms;
      if (v_side = 'long' and v_lo <= v_liq) or (v_side = 'short' and v_hi >= v_liq) then
        v.trades := jsonb_build_array(jsonb_build_object(
            'ms', v_ms, 'side', case when v_side = 'long' then 'SELL' else 'BUY' end,
            'intent', 'LIQ', 'px', round(v_liq, 2), 'amt', round(v_qty * v_liq, 2),
            'fee', 0, 'lev', v_poslev))
          || coalesce((select jsonb_agg(x order by n)
               from jsonb_array_elements(v.trades) with ordinality a(x,n) where n <= 49), '[]'::jsonb);
        v.liquidations := v.liquidations + 1;
        v_side := null; v_qty := 0; v_entry := 0; v_margin := 0;   -- 증거금 전액 소멸
        exit;
      end if;
    end loop;
  end if;

  -- ② 배수 변경 = 포지션 전체 재증거금 산정 (올리면 반환, 내리면 납입)
  if v_side is not null and v_poslev <> v_lev and p_action in ('buy','sell','leverage') then
    v_required := (v_qty * v_entry) / v_lev;
    v_delta := v_required - v_margin;
    if v_delta > v.wallet + 0.01 then raise exception 'INSUFFICIENT_MARGIN'; end if;
    v.wallet := v.wallet - v_delta;
    v_margin := v_required; v_poslev := v_lev;
  end if;

  -- ③ 주문
  if p_action in ('buy','sell') then
    if p_pct is null or p_pct <= 0 or p_pct > 1 then raise exception 'INVALID_ORDER'; end if;
    v_want := case when p_action = 'buy' then 'long' else 'short' end;

    if v_side is not null and v_side <> v_want then
      -- 반대 방향 = 보유 포지션 축소
      v_fill := v_qty * p_pct;
      v_notional := v_fill * p_price;
      if v_notional >= 1 then
        v_fee := v_notional * v_feerate;
        v_realized := (case when v_side = 'long' then p_price - v_entry else v_entry - p_price end) * v_fill;
        v_freed := v_margin * p_pct;
        v.wallet := v.wallet + v_freed + v_realized - v_fee;
        v_qty := v_qty - v_fill; v_margin := v_margin - v_freed;
        v_intent := case when v_side = 'long' then 'CLOSE' else 'COVER' end;
        if v_qty < 0.00000001 or v_margin <= 0 then
          v_side := null; v_qty := 0; v_entry := 0; v_margin := 0;
        end if;
      end if;
    else
      -- 신규 또는 같은 방향 추가 진입 (비율은 최대 주문가능 명목가 대비)
      v_maxn := (v.wallet * v_lev) / (1 + v_lev * v_feerate);
      v_notional := v_maxn * p_pct;
      if v_notional >= 1 then
        v_fee := v_notional * v_feerate;
        v_fill := v_notional / p_price;
        if v_side is null then
          v_side := v_want; v_qty := v_fill; v_entry := p_price;
          v_margin := v_notional / v_lev;
          v.wallet := v.wallet - v_margin - v_fee;
        else
          v_new_qty := v_qty + v_fill;
          v_new_entry := (v_entry * v_qty + p_price * v_fill) / v_new_qty;
          v_required := (v_new_qty * v_new_entry) / v_lev;
          v_delta := v_required - v_margin;
          if v_delta + v_fee > v.wallet + 0.01 then raise exception 'INVALID_ORDER'; end if;
          v.wallet := v.wallet - v_delta - v_fee;
          v_qty := v_new_qty; v_entry := v_new_entry; v_margin := v_required;
        end if;
        v_poslev := v_lev;
        v_intent := upper(v_want);
      end if;
    end if;

    if v_notional >= 1 then
      v.trades := jsonb_build_array(jsonb_build_object(
          'ms', p_now_ms, 'side', upper(p_action), 'intent', v_intent,
          'px', round(p_price, 2), 'amt', round(v_notional, 2),
          'fee', round(v_fee, 4), 'lev', v_lev))
        || coalesce((select jsonb_agg(x order by n)
             from jsonb_array_elements(v.trades) with ordinality a(x,n) where n <= 49), '[]'::jsonb);
    end if;
  end if;

  if v.wallet < 0 then v.wallet := 0; end if;
  v.pos := case when v_side is null then null else jsonb_build_object(
    'side', v_side, 'qty', round(v_qty, 10), 'entry', round(v_entry, 8),
    'margin', round(v_margin, 4), 'lev', v_poslev) end;
  -- 포지션이 없거나 이번에 새로 잡았다면 지금 시각까지 확인된 것으로 본다.
  -- 이어서 들고 있는 포지션은 실제로 훑은 마지막 봉까지만 인정한다
  -- (봉을 다 못 받아왔으면 다음 호출이 이어서 훑는다).
  if v_side is null or not v_had_pos then v.checked_ms := p_now_ms; end if;

  -- ④ 총자산과 파산 재충전
  v_equity := greatest(0, v.wallet + case when v_side is null then 0
    else v_margin + (case when v_side = 'long' then p_price - v_entry else v_entry - p_price end) * v_qty end);
  if v_side is null and v_equity < v_bust then
    v.wallet := v_seed; v.refills := v.refills + 1; v_equity := v_seed; v_refilled := true;
  end if;
  if v_equity > v.peak_equity then v.peak_equity := v_equity; end if;

  update public.paper_accounts set
    wallet = round(v.wallet, 4), pos = v.pos, checked_ms = v.checked_ms,
    refills = v.refills, liquidations = v.liquidations,
    peak_equity = round(v.peak_equity, 4), trades = v.trades, updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'wallet', round(v.wallet, 4), 'pos', v.pos, 'trades', v.trades,
    'refills', v.refills, 'liquidations', v.liquidations,
    'peak_equity', round(v.peak_equity, 4), 'equity', round(v_equity, 4),
    'refilled', v_refilled, 'price', p_price);
end;
$fn$;

revoke all on function public.paper_apply_internal(uuid,text,numeric,numeric,numeric,bigint,jsonb)
  from public, anon, authenticated;
grant execute on function public.paper_apply_internal(uuid,text,numeric,numeric,numeric,bigint,jsonb)
  to service_role;
