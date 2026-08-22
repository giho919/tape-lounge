-- Tape Lounge lounge chat. Anonymous Supabase users carry the authenticated role.
-- Snapshot of the live schema — re-runnable, safe to apply on top of itself.

create table if not exists public.salon_chat (
  id bigint primary key generated always as identity,
  created_at timestamptz not null default now(),
  nick text not null check (char_length(nick) between 1 and 20),
  body text not null check (char_length(body) between 1 and 300),
  user_id uuid default auth.uid(),
  author_type text not null default 'human',
  agent_key text
);

alter table public.salon_chat
  add column if not exists author_type text not null default 'human',
  add column if not exists agent_key text;

alter table public.salon_chat drop constraint if exists salon_chat_author_identity;
alter table public.salon_chat
  add constraint salon_chat_author_identity check (
    (author_type = 'human' and user_id is not null and agent_key is null)
    or
    (author_type = 'virtual' and user_id is null and agent_key in (
      'madam', 'andy', 'justin',
      'chart_doryeong', 'funding_bear', 'spot_sister', 'watcher',
      'degen', 'hermit', 'wolf'
    ))
  ) not valid;
alter table public.salon_chat validate constraint salon_chat_author_identity;

alter table public.salon_chat enable row level security;

-- 누구나 읽기 (라운지 피드는 로그인 없이 구경 가능)
drop policy if exists chat_read on public.salon_chat;
create policy chat_read on public.salon_chat
for select
to anon, authenticated
using (true);

-- 쓰기는 본인 user_id로만 — 익명 세션은 auth.uid()가 null이라 통과하지 못함
drop policy if exists chat_write on public.salon_chat;
create policy chat_write on public.salon_chat
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and author_type = 'human'
  and agent_key is null
);

-- update/delete 정책 없음 → RLS 기본 거부

-- 서버측 도배 방지 — 같은 user_id는 3초에 한 번만 (클라이언트 쿨다운과 별개)
create or replace function public.limit_salon_chat_rate()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
  declare
    actor_key text;
    cooldown interval;
  begin
    if new.author_type = 'virtual' then
      actor_key := 'virtual:' || new.agent_key;
      cooldown := interval '20 seconds';
    else
      actor_key := 'human:' || new.user_id::text;
      cooldown := interval '3 seconds';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(actor_key, 0));

    if exists (
      select 1
      from public.salon_chat
      where (
          (new.author_type = 'virtual' and author_type = 'virtual' and agent_key = new.agent_key)
          or
          (new.author_type = 'human' and author_type = 'human' and user_id = new.user_id)
        )
        and created_at > now() - cooldown
    ) then
      raise exception '채팅 발화 간격이 너무 짧습니다.';
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

create index if not exists salon_chat_human_rate_idx
  on public.salon_chat (user_id, created_at desc)
  where author_type = 'human';
create index if not exists salon_chat_virtual_rate_idx
  on public.salon_chat (agent_key, created_at desc)
  where author_type = 'virtual';

revoke all on public.salon_chat from anon, authenticated;
grant select on public.salon_chat to anon, authenticated;
grant insert (nick, body, user_id) on public.salon_chat to authenticated;
revoke all on sequence public.salon_chat_id_seq from anon, authenticated;
grant usage on sequence public.salon_chat_id_seq to authenticated;

revoke all on public.salon_chat from service_role;
grant select on public.salon_chat to service_role;
grant insert (nick, body, user_id, author_type, agent_key) on public.salon_chat to service_role;
revoke all on sequence public.salon_chat_id_seq from service_role;
grant usage on sequence public.salon_chat_id_seq to service_role;

-- 트리거 함수는 테이블 트리거만 실행하며 Data API RPC로 직접 호출할 이유가 없습니다.
revoke all on function public.limit_salon_chat_rate() from public, anon, authenticated;
