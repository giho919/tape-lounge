-- Tape Lounge leaderboard.
--
-- DEPRECATED — 다음 캔들 예측과 리더보드가 사이트에서 제거되면서(2026-08-15)
-- 이 테이블을 읽고 쓰는 코드가 없습니다. 기존 데이터 보존을 위해 남겨둔 스냅샷이며,
-- 정리하기로 하면 파일과 테이블을 함께 지우면 됩니다.

create table if not exists public.salon_board (
  user_id uuid primary key default auth.uid(),
  nick text not null check (char_length(nick) between 1 and 20),
  streak_best integer not null default 0 check (streak_best between 0 and 100000),
  w integer not null default 0 check (w >= 0),
  l integer not null default 0 check (l >= 0),
  blind_best numeric check (blind_best between -100 and 1000000),
  updated_at timestamptz not null default now()
);

alter table public.salon_board enable row level security;

drop policy if exists board_read on public.salon_board;
create policy board_read on public.salon_board
for select
using (true);

drop policy if exists board_insert on public.salon_board;
create policy board_insert on public.salon_board
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists board_update on public.salon_board;
create policy board_update on public.salon_board
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- delete 정책 없음 → RLS 기본 거부

-- 기록은 내려갈 수 없음 — 최고 연승·블라인드 최고 기록을 하향 조작하는 것을 막음
-- (Supabase 린터가 search_path 미설정을 경고합니다. 이 함수는 스키마 객체를 참조하지
--  않아 실제 위험은 없지만, 없애려면 language 줄 다음에 set search_path = '' 를 넣으면 됩니다.)
create or replace function public.board_monotonic()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.streak_best := greatest(new.streak_best, old.streak_best);
  new.blind_best  := greatest(coalesce(new.blind_best, -1e9), coalesce(old.blind_best, -1e9));
  return new;
end $function$;

drop trigger if exists board_monotonic_trg on public.salon_board;
create trigger board_monotonic_trg
before update on public.salon_board
for each row execute function public.board_monotonic();

-- 기능이 제거됐으므로 데이터는 보존하되 Data API에서는 완전히 닫습니다.
drop policy if exists board_read on public.salon_board;
drop policy if exists board_insert on public.salon_board;
drop policy if exists board_update on public.salon_board;
revoke all on public.salon_board from anon, authenticated;
revoke all on function public.board_monotonic() from public, anon, authenticated;
