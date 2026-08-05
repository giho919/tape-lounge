-- Tape Lounge blind-study rooms. Anonymous Supabase users carry the authenticated role.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.blind_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  host_nick text not null check (char_length(host_nick) between 1 and 10),
  track text not null check (track in ('crypto', 'stock')),
  seed integer not null check (seed between 1 and 2147483646),
  status text not null default 'lobby' check (status in ('lobby', 'running', 'finished')),
  start_at timestamptz,
  speed smallint not null default 1 check (speed in (1, 2, 4)),
  playing boolean not null default false,
  elapsed_ms bigint not null default 0 check (elapsed_ms between 0 and 480000),
  state_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 hours')
);

create table if not exists public.blind_room_players (
  room_id uuid not null references public.blind_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nick text not null check (char_length(nick) between 1 and 10),
  ready boolean not null default false,
  cash numeric(16,4) not null default 10000 check (cash between 0 and 1000000000),
  coin numeric(24,10) not null default 0 check (coin between 0 and 1000000000),
  roi numeric(10,4) check (roi between -100 and 100000),
  buy_hold numeric(10,4) check (buy_hold between -100 and 100000),
  trades jsonb not null default '[]'::jsonb check (jsonb_typeof(trades) = 'array' and jsonb_array_length(trades) <= 100),
  joined_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (room_id, user_id)
);

alter table public.blind_rooms add column if not exists speed smallint not null default 1;
alter table public.blind_rooms add column if not exists playing boolean not null default false;
alter table public.blind_rooms add column if not exists elapsed_ms bigint not null default 0;
alter table public.blind_rooms add column if not exists state_at timestamptz;
alter table public.blind_room_players add column if not exists cash numeric(16,4) not null default 10000;
alter table public.blind_room_players add column if not exists coin numeric(24,10) not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'blind_rooms_speed_check') then
    alter table public.blind_rooms add constraint blind_rooms_speed_check check (speed in (1, 2, 4));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blind_rooms_elapsed_ms_check') then
    alter table public.blind_rooms add constraint blind_rooms_elapsed_ms_check check (elapsed_ms between 0 and 480000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blind_room_players_cash_check') then
    alter table public.blind_room_players add constraint blind_room_players_cash_check check (cash between 0 and 1000000000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blind_room_players_coin_check') then
    alter table public.blind_room_players add constraint blind_room_players_coin_check check (coin between 0 and 1000000000);
  end if;
end $$;

create table if not exists public.blind_room_calls (
  room_id uuid not null,
  user_id uuid not null,
  day integer not null check (day between 0 and 200 and day % 20 = 0),
  stance text not null check (stance in ('bull', 'neutral', 'bear')),
  note text not null default '' check (char_length(note) <= 80),
  created_at timestamptz not null default now(),
  primary key (room_id, user_id, day),
  foreign key (room_id, user_id) references public.blind_room_players(room_id, user_id) on delete cascade
);

create index if not exists blind_rooms_status_expires_idx on public.blind_rooms(status, expires_at);
create index if not exists blind_rooms_host_user_idx on public.blind_rooms(host_user_id);
create index if not exists blind_room_players_user_idx on public.blind_room_players(user_id);
create index if not exists blind_room_calls_room_day_idx on public.blind_room_calls(room_id, day);

alter table public.blind_rooms enable row level security;
alter table public.blind_room_players enable row level security;
alter table public.blind_room_calls enable row level security;

create or replace function private.blind_is_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blind_room_players p
    where p.room_id = p_room_id and p.user_id = (select auth.uid())
  );
$$;

revoke all on function private.blind_is_member(uuid) from public;
grant execute on function private.blind_is_member(uuid) to authenticated;

drop policy if exists blind_rooms_member_read on public.blind_rooms;
create policy blind_rooms_member_read on public.blind_rooms
for select to authenticated
using ((select private.blind_is_member(id)));

drop policy if exists blind_players_member_read on public.blind_room_players;
create policy blind_players_member_read on public.blind_room_players
for select to authenticated
using ((select private.blind_is_member(room_id)));

drop policy if exists blind_players_self_ready on public.blind_room_players;
create policy blind_players_self_ready on public.blind_room_players
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists blind_calls_reveal on public.blind_room_calls;
create policy blind_calls_reveal on public.blind_room_calls
for select to authenticated
using (
  (select auth.uid()) = user_id
  or (
    (select private.blind_is_member(room_id))
    and exists (select 1 from public.blind_rooms r where r.id = room_id and r.status = 'finished')
  )
);

revoke all on public.blind_rooms, public.blind_room_players, public.blind_room_calls from anon, authenticated;
grant select on public.blind_rooms, public.blind_room_players, public.blind_room_calls to authenticated;
grant update (ready) on public.blind_room_players to authenticated;

create or replace function private.blind_create_room(p_track text, p_nick text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_room uuid;
  v_code text;
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_track not in ('crypto', 'stock') then raise exception 'INVALID_TRACK'; end if;
  if char_length(trim(p_nick)) not between 1 and 10 then raise exception 'INVALID_NICK'; end if;

  delete from public.blind_rooms where expires_at < now() - interval '1 day';
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::integer, 1);
    end loop;
    begin
      insert into public.blind_rooms(code, host_user_id, host_nick, track, seed)
      values (v_code, v_uid, trim(p_nick), p_track, 1 + floor(random() * 2147483645)::integer)
      returning id into v_room;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  insert into public.blind_room_players(room_id, user_id, nick)
  values (v_room, v_uid, trim(p_nick));
  return v_room;
end;
$$;

create or replace function private.blind_join_room(p_code text, p_nick text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_room uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(p_nick)) not between 1 and 10 then raise exception 'INVALID_NICK'; end if;
  select r.id into v_room
  from public.blind_rooms r
  where r.code = upper(trim(p_code)) and r.status = 'lobby' and r.expires_at > now()
  limit 1;
  if v_room is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if (select count(*) from public.blind_room_players p where p.room_id = v_room) >= 12 then raise exception 'ROOM_FULL'; end if;

  insert into public.blind_room_players(room_id, user_id, nick)
  values (v_room, v_uid, trim(p_nick))
  on conflict (room_id, user_id) do update set nick = excluded.nick;
  return v_room;
end;
$$;

create or replace function private.blind_leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_host uuid;
  v_status text;
begin
  select host_user_id, status into v_host, v_status from public.blind_rooms where id = p_room_id;
  if v_status <> 'lobby' or not exists (
    select 1 from public.blind_room_players p where p.room_id = p_room_id and p.user_id = v_uid
  ) then raise exception 'CANNOT_LEAVE'; end if;
  if v_host = v_uid then delete from public.blind_rooms where id = p_room_id;
  else delete from public.blind_room_players where room_id = p_room_id and user_id = v_uid;
  end if;
end;
$$;

create or replace function private.blind_lock_call(p_room_id uuid, p_stance text, p_note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_room public.blind_rooms%rowtype;
  v_elapsed bigint;
  v_day integer;
begin
  if p_stance not in ('bull', 'neutral', 'bear') then raise exception 'INVALID_STANCE'; end if;
  if char_length(coalesce(p_note, '')) > 80 then raise exception 'INVALID_NOTE'; end if;
  select * into v_room from public.blind_rooms r
  where r.id = p_room_id and r.status = 'running';
  if v_room.start_at is null or now() < v_room.start_at or not exists (
    select 1 from public.blind_room_players p where p.room_id = p_room_id and p.user_id = v_uid and p.ready
  ) then raise exception 'CALL_NOT_OPEN'; end if;
  v_elapsed := least(480000::bigint, v_room.elapsed_ms + case
    when v_room.playing and v_room.state_at is not null
      then greatest(0::bigint, floor(extract(epoch from (now() - v_room.state_at)) * 1000 * v_room.speed)::bigint)
    else 0::bigint end);
  v_day := least(180, greatest(0, floor(v_elapsed / 2400.0 / 20) * 20)::integer);
  insert into public.blind_room_calls(room_id, user_id, day, stance, note)
  values (p_room_id, v_uid, v_day, p_stance, coalesce(trim(p_note), ''));
  return v_day;
end;
$$;

create or replace function private.blind_start_room(p_room_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_start timestamptz;
begin
  if not exists (
    select 1 from public.blind_rooms r
    where r.id = p_room_id and r.host_user_id = v_uid and r.status = 'lobby' and r.expires_at > now()
  ) then raise exception 'HOST_ONLY'; end if;
  if (select count(*) from public.blind_room_players p where p.room_id = p_room_id) < 2 then
    raise exception 'NEED_TWO_PLAYERS';
  end if;
  if exists (select 1 from public.blind_room_players p where p.room_id = p_room_id and not p.ready) then
    raise exception 'NOT_ALL_READY';
  end if;
  v_start := now() + interval '10 seconds';
  update public.blind_rooms
  set status = 'running', start_at = v_start, speed = 1, playing = true,
      elapsed_ms = 0, state_at = v_start
  where id = p_room_id;
  return v_start;
end;
$$;

create or replace function private.blind_control_room(p_room_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_room public.blind_rooms%rowtype;
  v_elapsed bigint;
  v_speed smallint;
begin
  select * into v_room from public.blind_rooms where id = p_room_id for update;
  if v_room.id is null or v_room.host_user_id <> v_uid then raise exception 'HOST_ONLY'; end if;
  if v_room.status <> 'running' or v_room.start_at is null or now() < v_room.start_at then raise exception 'CONTROL_NOT_OPEN'; end if;

  v_elapsed := least(480000::bigint, v_room.elapsed_ms + case
    when v_room.playing and v_room.state_at is not null
      then greatest(0::bigint, floor(extract(epoch from (now() - v_room.state_at)) * 1000 * v_room.speed)::bigint)
    else 0::bigint end);

  if p_action = 'settle' then
    update public.blind_rooms set status = 'finished', playing = false, elapsed_ms = v_elapsed, state_at = now()
    where id = p_room_id;
  elsif p_action = 'pause' then
    update public.blind_rooms set playing = false, elapsed_ms = v_elapsed, state_at = now()
    where id = p_room_id;
  elsif p_action = 'play' then
    update public.blind_rooms set playing = true, elapsed_ms = v_elapsed, state_at = now()
    where id = p_room_id;
  elsif p_action in ('speed_1', 'speed_2', 'speed_4') then
    v_speed := right(p_action, 1)::smallint;
    update public.blind_rooms set speed = v_speed, elapsed_ms = v_elapsed, state_at = now()
    where id = p_room_id;
  else
    raise exception 'INVALID_CONTROL';
  end if;
end;
$$;

create or replace function private.blind_save_player_state(p_room_id uuid, p_cash numeric, p_coin numeric, p_trades jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_cash not between 0 and 1000000000 or p_coin not between 0 and 1000000000 then raise exception 'INVALID_PORTFOLIO'; end if;
  if jsonb_typeof(p_trades) <> 'array' or jsonb_array_length(p_trades) > 100 then raise exception 'INVALID_TRADES'; end if;
  if not exists (
    select 1 from public.blind_rooms r join public.blind_room_players p on p.room_id = r.id
    where r.id = p_room_id and r.status = 'running' and p.user_id = v_uid and p.ready
  ) then raise exception 'NOT_A_MEMBER'; end if;

  update public.blind_room_players
  set cash = p_cash, coin = p_coin, trades = p_trades
  where room_id = p_room_id and user_id = v_uid;
end;
$$;

create or replace function private.blind_update_nick(p_room_id uuid, p_nick text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(p_nick)) not between 1 and 10 then raise exception 'INVALID_NICK'; end if;

  update public.blind_room_players
  set nick = trim(p_nick)
  where room_id = p_room_id and user_id = v_uid;
  if not found then raise exception 'NOT_A_MEMBER'; end if;

  update public.blind_rooms
  set host_nick = trim(p_nick)
  where id = p_room_id and host_user_id = v_uid;
end;
$$;

create or replace function private.blind_finish_room(p_room_id uuid, p_roi numeric, p_buy_hold numeric, p_trades jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_room public.blind_rooms%rowtype;
  v_elapsed bigint;
begin
  select * into v_room from public.blind_rooms where id = p_room_id and status in ('running', 'finished') for update;
  if v_room.id is null or not exists (
    select 1 from public.blind_room_players p where p.room_id = p_room_id and p.user_id = v_uid
  ) then raise exception 'NOT_A_MEMBER'; end if;
  v_elapsed := least(480000::bigint, v_room.elapsed_ms + case
    when v_room.playing and v_room.state_at is not null
      then greatest(0::bigint, floor(extract(epoch from (now() - v_room.state_at)) * 1000 * v_room.speed)::bigint)
    else 0::bigint end);
  if v_room.status <> 'finished' and v_elapsed < 480000 then raise exception 'ROUND_NOT_OVER'; end if;
  if p_roi not between -100 and 100000 or p_buy_hold not between -100 and 100000 then raise exception 'INVALID_RESULT'; end if;
  if jsonb_typeof(p_trades) <> 'array' or jsonb_array_length(p_trades) > 100 then raise exception 'INVALID_TRADES'; end if;

  update public.blind_room_players
  set roi = p_roi, buy_hold = p_buy_hold, trades = p_trades, finished_at = now()
  where room_id = p_room_id and user_id = v_uid;
  update public.blind_rooms
  set status = 'finished', playing = false, elapsed_ms = v_elapsed, state_at = now()
  where id = p_room_id;
end;
$$;

revoke all on function private.blind_create_room(text, text) from public;
revoke all on function private.blind_join_room(text, text) from public;
revoke all on function private.blind_leave_room(uuid) from public;
revoke all on function private.blind_lock_call(uuid, text, text) from public;
revoke all on function private.blind_start_room(uuid) from public;
revoke all on function private.blind_control_room(uuid, text) from public;
revoke all on function private.blind_save_player_state(uuid, numeric, numeric, jsonb) from public;
revoke all on function private.blind_update_nick(uuid, text) from public;
revoke all on function private.blind_finish_room(uuid, numeric, numeric, jsonb) from public;
grant execute on function private.blind_create_room(text, text) to authenticated;
grant execute on function private.blind_join_room(text, text) to authenticated;
grant execute on function private.blind_leave_room(uuid) to authenticated;
grant execute on function private.blind_lock_call(uuid, text, text) to authenticated;
grant execute on function private.blind_start_room(uuid) to authenticated;
grant execute on function private.blind_control_room(uuid, text) to authenticated;
grant execute on function private.blind_save_player_state(uuid, numeric, numeric, jsonb) to authenticated;
grant execute on function private.blind_update_nick(uuid, text) to authenticated;
grant execute on function private.blind_finish_room(uuid, numeric, numeric, jsonb) to authenticated;

create or replace function public.blind_create_room(p_track text, p_nick text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.blind_create_room(p_track, p_nick); $$;
create or replace function public.blind_join_room(p_code text, p_nick text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.blind_join_room(p_code, p_nick); $$;
create or replace function public.blind_leave_room(p_room_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.blind_leave_room(p_room_id); $$;
create or replace function public.blind_lock_call(p_room_id uuid, p_stance text, p_note text)
returns integer language sql security invoker set search_path = ''
as $$ select private.blind_lock_call(p_room_id, p_stance, p_note); $$;
create or replace function public.blind_start_room(p_room_id uuid)
returns timestamptz language sql security invoker set search_path = ''
as $$ select private.blind_start_room(p_room_id); $$;
create or replace function public.blind_control_room(p_room_id uuid, p_action text)
returns void language sql security invoker set search_path = ''
as $$ select private.blind_control_room(p_room_id, p_action); $$;
create or replace function public.blind_save_player_state(p_room_id uuid, p_cash numeric, p_coin numeric, p_trades jsonb)
returns void language sql security invoker set search_path = ''
as $$ select private.blind_save_player_state(p_room_id, p_cash, p_coin, p_trades); $$;
create or replace function public.blind_update_nick(p_room_id uuid, p_nick text)
returns void language sql security invoker set search_path = ''
as $$ select private.blind_update_nick(p_room_id, p_nick); $$;
create or replace function public.blind_finish_room(p_room_id uuid, p_roi numeric, p_buy_hold numeric, p_trades jsonb)
returns void language sql security invoker set search_path = ''
as $$ select private.blind_finish_room(p_room_id, p_roi, p_buy_hold, p_trades); $$;
create or replace function public.blind_server_time()
returns timestamptz language sql stable security invoker set search_path = ''
as $$ select now(); $$;

revoke all on function public.blind_create_room(text, text) from public;
revoke all on function public.blind_join_room(text, text) from public;
revoke all on function public.blind_leave_room(uuid) from public;
revoke all on function public.blind_lock_call(uuid, text, text) from public;
revoke all on function public.blind_start_room(uuid) from public;
revoke all on function public.blind_control_room(uuid, text) from public;
revoke all on function public.blind_save_player_state(uuid, numeric, numeric, jsonb) from public;
revoke all on function public.blind_update_nick(uuid, text) from public;
revoke all on function public.blind_finish_room(uuid, numeric, numeric, jsonb) from public;
revoke all on function public.blind_server_time() from public;
grant execute on function public.blind_create_room(text, text) to authenticated;
grant execute on function public.blind_join_room(text, text) to authenticated;
grant execute on function public.blind_leave_room(uuid) to authenticated;
grant execute on function public.blind_lock_call(uuid, text, text) to authenticated;
grant execute on function public.blind_start_room(uuid) to authenticated;
grant execute on function public.blind_control_room(uuid, text) to authenticated;
grant execute on function public.blind_save_player_state(uuid, numeric, numeric, jsonb) to authenticated;
grant execute on function public.blind_update_nick(uuid, text) to authenticated;
grant execute on function public.blind_finish_room(uuid, numeric, numeric, jsonb) to authenticated;
grant execute on function public.blind_server_time() to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'blind_rooms') then
    alter publication supabase_realtime add table public.blind_rooms;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'blind_room_players') then
    alter publication supabase_realtime add table public.blind_room_players;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'blind_room_calls') then
    alter publication supabase_realtime add table public.blind_room_calls;
  end if;
end $$;
