-- Tape Lounge · 블라인드 차트 격리 마진 레버리지 (최대 10배)
-- 함께 보는 판의 주문·청산·정산을 서버가 다시 계산하도록 장부 모델을 교체한다.
-- 기존 cash/coin(현물+공매도) → wallet(지갑) + pos(격리 마진 포지션).

alter table public.blind_room_players add column if not exists wallet numeric(16,4) not null default 10000;
alter table public.blind_room_players add column if not exists pos jsonb;
-- 강제청산 판정을 마친 마지막 시뮬레이션 일자 (중복 청산 방지)
alter table public.blind_room_players add column if not exists liq_day integer not null default -1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'blind_room_players_wallet_check') then
    alter table public.blind_room_players
      add constraint blind_room_players_wallet_check check (wallet between 0 and 1000000000);
  end if;
end $$;

-- 구 시그니처(레버리지 없음) 제거 후 교체
drop function if exists public.blind_apply_trade_internal(uuid, uuid, text, numeric);

create or replace function public.blind_apply_trade_internal(
  p_room_id uuid, p_user_id uuid, p_action text, p_pct numeric, p_lev numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.blind_rooms%rowtype;
  v_player public.blind_room_players%rowtype;
  v_round private.blind_round_data%rowtype;
  v_elapsed bigint;
  v_day integer;
  v_px numeric;
  v_lev numeric;
  v_side text;
  v_qty numeric;
  v_entry numeric;
  v_margin numeric;
  v_liq numeric;
  v_notional numeric := 0;
  v_fill numeric := 0;
  v_fee numeric := 0;
  v_intent text;
  v_realized numeric;
  v_freed numeric;
  v_poslev numeric;
  v_maxn numeric;
  v_new_qty numeric;
  v_new_entry numeric;
  v_required numeric;
  v_delta numeric;
  v_i integer;
  v_base integer;
  v_hi numeric;
  v_lo numeric;
  v_trade jsonb;
  v_mmr constant numeric := 0.005;   -- 유지증거금률 0.5%
  v_feerate constant numeric := 0.001;
begin
  if p_action not in ('buy','sell') or p_pct <= 0 or p_pct > 1 then raise exception 'INVALID_ORDER'; end if;
  v_lev := floor(coalesce(p_lev, 1));
  if v_lev < 1 or v_lev > 10 then raise exception 'INVALID_ORDER'; end if;

  select * into v_room from public.blind_rooms where id = p_room_id for update;
  select * into v_player from public.blind_room_players
    where room_id = p_room_id and user_id = p_user_id for update;
  select * into v_round from private.blind_round_data where room_id = p_room_id;
  if v_room.status <> 'running' or v_player.user_id is null or not v_player.ready or v_round.room_id is null
     or v_room.start_at is null or now() < v_room.start_at then raise exception 'ORDER_NOT_OPEN'; end if;

  v_elapsed := least(480000::bigint, v_room.elapsed_ms + case
    when v_room.playing and v_room.state_at is not null
      then greatest(0::bigint, floor(extract(epoch from (now() - v_room.state_at)) * 1000 * v_room.speed)::bigint)
    else 0::bigint end);
  v_day := least(200, greatest(0, floor(v_elapsed / 2400.0)::integer));
  -- 플레이 시작 봉 인덱스는 저장된 길이에서 유도 (구 460봉 라운드도 그대로 동작)
  v_base := jsonb_array_length(v_round.candles) - 201;
  v_px := (v_round.candles -> (v_base + v_day) ->> 4)::numeric;

  v_side := v_player.pos ->> 'side';
  v_qty := coalesce((v_player.pos ->> 'qty')::numeric, 0);
  v_entry := coalesce((v_player.pos ->> 'entry')::numeric, 0);
  v_margin := coalesce((v_player.pos ->> 'margin')::numeric, 0);
  v_poslev := coalesce((v_player.pos ->> 'lev')::numeric, 1);

  -- ── 지난 봉의 고저가로 강제청산 소급 판정 ──
  if v_side is not null and v_qty > 0 and v_margin > 0 then
    v_liq := greatest(0, case when v_side = 'long'
      then v_entry - (v_margin / v_qty - v_mmr * v_entry)
      else v_entry + (v_margin / v_qty - v_mmr * v_entry) end);
    for v_i in greatest(0, v_player.liq_day + 1) .. v_day loop
      v_hi := (v_round.candles -> (v_base + v_i) ->> 2)::numeric;
      v_lo := (v_round.candles -> (v_base + v_i) ->> 3)::numeric;
      if (v_side = 'long' and v_lo <= v_liq) or (v_side = 'short' and v_hi >= v_liq) then
        v_player.trades := jsonb_build_array(jsonb_build_object(
          'day', v_i, 'side', case when v_side = 'long' then 'SELL' else 'BUY' end,
          'intent', 'LIQ', 'px', round(v_liq, 8), 'amt', round(v_qty * v_liq, 4), 'fee', 0,
          'lev', round((v_qty * v_entry) / v_margin, 1)
        )) || coalesce((select jsonb_agg(x order by n)
          from jsonb_array_elements(v_player.trades) with ordinality a(x,n) where n <= 99), '[]'::jsonb);
        v_side := null; v_qty := 0; v_entry := 0; v_margin := 0;   -- 증거금 전액 소멸
        exit;
      end if;
    end loop;
  end if;
  v_player.liq_day := v_day;

  -- 배수가 바뀌었으면 포지션 전체 필요증거금을 다시 산정 (명목가 ÷ 배수)
  if v_side is not null and v_poslev <> v_lev then
    v_required := (v_qty * v_entry) / v_lev;
    v_delta := v_required - v_margin;
    if v_delta > v_player.wallet + 0.000000001 then raise exception 'INSUFFICIENT_MARGIN'; end if;
    v_player.wallet := v_player.wallet - v_delta;
    v_margin := v_required;
    v_poslev := v_lev;
  end if;

  if p_action = 'buy' then v_intent := 'long'; else v_intent := 'short'; end if;

  if v_side is not null and v_side <> v_intent then
    -- 반대 방향 = 보유 포지션 축소
    v_fill := v_qty * p_pct;
    v_notional := v_fill * v_px;
    if v_notional >= 1 then
      v_fee := v_notional * v_feerate;
      v_realized := (case when v_side = 'long' then v_px - v_entry else v_entry - v_px end) * v_fill;
      v_freed := v_margin * p_pct;
      v_player.wallet := v_player.wallet + v_freed + v_realized - v_fee;
      v_qty := v_qty - v_fill; v_margin := v_margin - v_freed;
      v_intent := case when v_side = 'long' then 'CLOSE' else 'COVER' end;
      if v_qty < 0.0000000001 or v_margin <= 0 then v_side := null; v_qty := 0; v_entry := 0; v_margin := 0; end if;
    end if;
  else
    -- 신규/추가 진입 — 주문 비율은 최대 주문가능 명목가 대비
    v_maxn := (v_player.wallet * v_lev) / (1 + v_lev * v_feerate);
    v_notional := v_maxn * p_pct;
    if v_notional >= 1 then
      v_fee := v_notional * v_feerate;
      v_fill := v_notional / v_px;
      if v_side is null then
        v_side := v_intent; v_qty := v_fill; v_entry := v_px;
        v_margin := v_notional / v_lev;
        v_player.wallet := v_player.wallet - v_margin - v_fee;
      else
        v_new_qty := v_qty + v_fill;
        v_new_entry := (v_entry * v_qty + v_px * v_fill) / v_new_qty;
        v_required := (v_new_qty * v_new_entry) / v_lev;
        v_delta := v_required - v_margin;
        if v_delta + v_fee > v_player.wallet + 0.000000001 then raise exception 'INVALID_ORDER'; end if;
        v_player.wallet := v_player.wallet - v_delta - v_fee;
        v_qty := v_new_qty; v_entry := v_new_entry; v_margin := v_required;
      end if;
      v_poslev := v_lev;
      v_intent := upper(v_intent);
    end if;
  end if;

  if v_player.wallet < 0 then v_player.wallet := 0; end if;
  v_player.pos := case when v_side is null then null else jsonb_build_object(
    'side', v_side, 'qty', round(v_qty, 10), 'entry', round(v_entry, 8),
    'margin', round(v_margin, 4), 'lev', v_poslev) end;

  if v_notional >= 1 then
    v_trade := jsonb_build_object('day', v_day, 'side', case when p_action='buy' then 'BUY' else 'SELL' end,
      'intent', v_intent, 'px', round(v_px,8), 'amt', round(v_notional,4), 'fee', round(v_fee,4), 'lev', v_lev);
    v_player.trades := jsonb_build_array(v_trade) || coalesce((select jsonb_agg(x order by n)
      from jsonb_array_elements(v_player.trades) with ordinality a(x,n) where n <= 99), '[]'::jsonb);
  end if;

  update public.blind_room_players
    set wallet = round(v_player.wallet,4), pos = v_player.pos,
        liq_day = v_player.liq_day, trades = v_player.trades
    where room_id = p_room_id and user_id = p_user_id;
  return jsonb_build_object('wallet', round(v_player.wallet,4), 'pos', v_player.pos, 'trades', v_player.trades);
end;
$$;

create or replace function public.blind_finish_player_internal(p_room_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.blind_rooms%rowtype;
  v_player public.blind_room_players%rowtype;
  v_round private.blind_round_data%rowtype;
  v_elapsed bigint;
  v_day integer;
  v_px numeric;
  v_start_px numeric;
  v_side text; v_qty numeric; v_entry numeric; v_margin numeric;
  v_liq numeric; v_i integer; v_base integer; v_hi numeric; v_lo numeric;
  v_equity numeric;
  v_roi numeric;
  v_bh numeric;
  v_mmr constant numeric := 0.005;
begin
  select * into v_room from public.blind_rooms where id=p_room_id for update;
  select * into v_player from public.blind_room_players where room_id=p_room_id and user_id=p_user_id for update;
  select * into v_round from private.blind_round_data where room_id=p_room_id;
  if v_room.id is null or v_player.user_id is null or v_round.room_id is null then raise exception 'NOT_A_MEMBER'; end if;
  v_elapsed := least(480000::bigint, v_room.elapsed_ms + case
    when v_room.playing and v_room.state_at is not null
      then greatest(0::bigint, floor(extract(epoch from (now() - v_room.state_at)) * 1000 * v_room.speed)::bigint)
    else 0::bigint end);
  if v_room.status <> 'finished' and v_elapsed < 480000 then raise exception 'ROUND_NOT_OVER'; end if;
  v_day := least(200, greatest(0, floor(v_elapsed / 2400.0)::integer));
  -- 플레이 시작 봉 인덱스는 저장된 길이에서 유도 (구 460봉 라운드도 그대로 동작)
  v_base := jsonb_array_length(v_round.candles) - 201;
  v_px := (v_round.candles -> (v_base + v_day) ->> 4)::numeric;
  v_start_px := (v_round.candles -> v_base ->> 4)::numeric;

  v_side := v_player.pos ->> 'side';
  v_qty := coalesce((v_player.pos ->> 'qty')::numeric, 0);
  v_entry := coalesce((v_player.pos ->> 'entry')::numeric, 0);
  v_margin := coalesce((v_player.pos ->> 'margin')::numeric, 0);

  -- 정산 시점까지 남은 봉의 강제청산도 반영
  if v_side is not null and v_qty > 0 and v_margin > 0 then
    v_liq := greatest(0, case when v_side = 'long'
      then v_entry - (v_margin / v_qty - v_mmr * v_entry)
      else v_entry + (v_margin / v_qty - v_mmr * v_entry) end);
    for v_i in greatest(0, v_player.liq_day + 1) .. v_day loop
      v_hi := (v_round.candles -> (v_base + v_i) ->> 2)::numeric;
      v_lo := (v_round.candles -> (v_base + v_i) ->> 3)::numeric;
      if (v_side = 'long' and v_lo <= v_liq) or (v_side = 'short' and v_hi >= v_liq) then
        v_side := null; v_qty := 0; v_margin := 0;
        exit;
      end if;
    end loop;
  end if;

  v_equity := greatest(0::numeric, v_player.wallet + case when v_side is null then 0
    else v_margin + (case when v_side = 'long' then v_px - v_entry else v_entry - v_px end) * v_qty end);
  v_roi := round((v_equity / 10000 - 1) * 100, 4);
  v_bh := round((v_px / v_start_px - 1) * 100, 4);
  update public.blind_room_players set roi=v_roi, buy_hold=v_bh, liq_day=v_day,
    finished_at=coalesce(finished_at, now())
    where room_id=p_room_id and user_id=p_user_id;
  if v_room.status <> 'finished' then
    update public.blind_rooms set status='finished', playing=false, elapsed_ms=v_elapsed, state_at=now() where id=p_room_id;
  end if;
  return jsonb_build_object('wallet', v_player.wallet, 'pos', v_player.pos, 'trades', v_player.trades,
    'roi', v_roi, 'buy_hold', v_bh, 'symbol', v_round.symbol,
    'real_start', v_round.real_start, 'real_end', v_round.real_end);
end;
$$;

-- 주문 없이 배수만 바꿀 때도 서버가 재증거금을 산정한다
create or replace function public.blind_set_leverage_internal(
  p_room_id uuid, p_user_id uuid, p_lev numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $lev$
declare
  v_player public.blind_room_players%rowtype;
  v_lev numeric;
  v_qty numeric; v_entry numeric; v_margin numeric;
  v_required numeric; v_delta numeric;
begin
  v_lev := floor(coalesce(p_lev, 1));
  if v_lev < 1 or v_lev > 10 then raise exception 'INVALID_ORDER'; end if;
  select * into v_player from public.blind_room_players
    where room_id = p_room_id and user_id = p_user_id for update;
  if v_player.user_id is null then raise exception 'NOT_A_MEMBER'; end if;

  if v_player.pos is not null then
    v_qty := coalesce((v_player.pos ->> 'qty')::numeric, 0);
    v_entry := coalesce((v_player.pos ->> 'entry')::numeric, 0);
    v_margin := coalesce((v_player.pos ->> 'margin')::numeric, 0);
    v_required := (v_qty * v_entry) / v_lev;
    v_delta := v_required - v_margin;
    if v_delta > v_player.wallet + 0.000000001 then raise exception 'INSUFFICIENT_MARGIN'; end if;
    v_player.wallet := v_player.wallet - v_delta;
    v_player.pos := jsonb_set(jsonb_set(v_player.pos,
      '{margin}', to_jsonb(round(v_required, 4))), '{lev}', to_jsonb(v_lev));
    update public.blind_room_players
      set wallet = round(v_player.wallet, 4), pos = v_player.pos
      where room_id = p_room_id and user_id = p_user_id;
  end if;
  return jsonb_build_object('wallet', round(v_player.wallet,4), 'pos', v_player.pos, 'trades', v_player.trades);
end;
$lev$;

revoke all on function public.blind_set_leverage_internal(uuid,uuid,numeric) from public, anon, authenticated;
grant execute on function public.blind_set_leverage_internal(uuid,uuid,numeric) to service_role;

revoke all on function public.blind_apply_trade_internal(uuid,uuid,text,numeric,numeric) from public, anon, authenticated;
revoke all on function public.blind_finish_player_internal(uuid,uuid) from public, anon, authenticated;
grant execute on function public.blind_apply_trade_internal(uuid,uuid,text,numeric,numeric) to service_role;
grant execute on function public.blind_finish_player_internal(uuid,uuid) to service_role;
