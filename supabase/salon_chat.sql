-- Tape Lounge lounge chat. Anonymous Supabase users carry the authenticated role.
-- Snapshot of the live schema — re-runnable, safe to apply on top of itself.

create table if not exists public.salon_chat (
  id bigint primary key generated always as identity,
  created_at timestamptz not null default now(),
  nick text not null check (char_length(nick) between 1 and 20),
  body text not null check (char_length(body) between 1 and 300),
  user_id uuid default auth.uid()
);

alter table public.salon_chat enable row level security;

-- 누구나 읽기 (라운지 피드는 로그인 없이 구경 가능)
drop policy if exists chat_read on public.salon_chat;
create policy chat_read on public.salon_chat
for select
using (true);

-- 쓰기는 본인 user_id로만 — 익명 세션은 auth.uid()가 null이라 통과하지 못함
drop policy if exists chat_write on public.salon_chat;
create policy chat_write on public.salon_chat
for insert
with check ((select auth.uid()) = user_id);

-- update/delete 정책 없음 → RLS 기본 거부

-- 서버측 도배 방지 — 같은 user_id는 3초에 한 번만 (클라이언트 쿨다운과 별개)
create or replace function public.limit_salon_chat_rate()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
  begin
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));

    if exists (
      select 1
      from public.salon_chat
      where user_id = new.user_id
        and created_at > now() - interval '3 seconds'
    ) then
      raise exception '채팅은 3초에 한 번만 보낼 수 있습니다.';
    end if;

    return new;
  end;
  $function$;

drop trigger if exists salon_chat_rate_limit on public.salon_chat;
create trigger salon_chat_rate_limit
before insert on public.salon_chat
for each row execute function public.limit_salon_chat_rate();

-- 실시간 구독 (클라이언트가 실제 관여할 때만 채널을 엶)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'salon_chat'
  ) then
    alter publication supabase_realtime add table public.salon_chat;
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────
-- 선택: 권한 조이기
--
-- 이 테이블은 Supabase 기본 grant(anon/authenticated에 TRUNCATE·TRIGGER 포함)를
-- 그대로 쓰고 있습니다. blind_rooms.sql처럼 필요한 것만 남기려면 아래를 실행하세요.
-- PostgREST가 TRUNCATE를 노출하지는 않지만, 최소 권한 원칙에는 어긋납니다.
--
-- revoke all on public.salon_chat from anon, authenticated;
-- grant select on public.salon_chat to anon, authenticated;
-- grant insert (nick, body, user_id) on public.salon_chat to authenticated;
-- ─────────────────────────────────────────────────────────────
