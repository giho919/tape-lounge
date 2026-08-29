-- 라운지 모의투자 · 실시간 포지션 랭킹
-- 열린 포지션의 원본(방향·진입가·수량·증거금·배수)만 내려주고,
-- 순위는 클라이언트가 실시간 시세로 ROE를 계산해 매긴다.
-- 가짜 돈 게임이므로 포지션 공개에 민감 정보가 없다. 닉네임이 없으면
-- user_id 해시로 익명 표시명을 만든다.

alter table public.paper_accounts add column if not exists nick text;

create or replace function public.paper_leaderboard()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'nick',   coalesce(nullif(trim(a.nick), ''), '게스트 ' || upper(substr(md5(a.user_id::text), 1, 4))),
    'side',   a.pos->>'side',
    'entry',  (a.pos->>'entry')::numeric,
    'qty',    (a.pos->>'qty')::numeric,
    'margin', (a.pos->>'margin')::numeric,
    'lev',    (a.pos->>'lev')::numeric,
    'me',     a.user_id = auth.uid()
  )), '[]'::jsonb)
  from (
    select * from public.paper_accounts
    where pos is not null
      and (pos->>'qty')::numeric > 0
      and (pos->>'margin')::numeric > 0
    order by updated_at desc
    limit 50
  ) a;
$$;

revoke all on function public.paper_leaderboard() from public;
grant execute on function public.paper_leaderboard() to anon, authenticated;
