-- Tape Lounge privacy-first visitor analytics.
-- Public clients may only call record_site_activity(); raw rows and aggregates stay private.

create extension if not exists pg_cron;

create table if not exists private.site_visitors (
  visitor_hash bytea primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists private.site_visit_sessions (
  session_hash bytea primary key,
  visitor_hash bytea not null references private.site_visitors(visitor_hash) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  current_tab text not null,
  active_seconds integer not null default 0 check (active_seconds between 0 and 86400)
);

create table if not exists private.site_tab_activity (
  session_hash bytea not null references private.site_visit_sessions(session_hash) on delete cascade,
  activity_day date not null,
  tab text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  view_count integer not null default 0 check (view_count between 0 and 10000),
  active_seconds integer not null default 0 check (active_seconds between 0 and 86400),
  primary key (session_hash, activity_day, tab)
);

create table if not exists private.site_analytics_daily (
  day date primary key,
  visitors integer not null,
  new_visitors integer not null,
  returning_visitors integer not null,
  sessions integer not null,
  total_active_seconds bigint not null,
  average_session_seconds integer not null,
  updated_at timestamptz not null default now()
);

create table if not exists private.site_analytics_tabs_daily (
  day date not null,
  tab text not null,
  views bigint not null,
  visitors integer not null,
  active_seconds bigint not null,
  updated_at timestamptz not null default now(),
  primary key (day, tab)
);

alter table private.site_visitors enable row level security;
alter table private.site_visit_sessions enable row level security;
alter table private.site_tab_activity enable row level security;
alter table private.site_analytics_daily enable row level security;
alter table private.site_analytics_tabs_daily enable row level security;

revoke all on private.site_visitors from public, anon, authenticated;
revoke all on private.site_visit_sessions from public, anon, authenticated;
revoke all on private.site_tab_activity from public, anon, authenticated;
revoke all on private.site_analytics_daily from public, anon, authenticated;
revoke all on private.site_analytics_tabs_daily from public, anon, authenticated;

create index if not exists site_visit_sessions_visitor_idx
  on private.site_visit_sessions (visitor_hash, started_at desc);
create index if not exists site_visit_sessions_started_idx
  on private.site_visit_sessions (started_at desc);
create index if not exists site_visit_sessions_seen_idx
  on private.site_visit_sessions (last_seen_at);
create index if not exists site_tab_activity_day_idx
  on private.site_tab_activity (activity_day, tab);

create or replace function public.record_site_activity(
  p_visitor_id uuid,
  p_session_id uuid,
  p_tab text,
  p_active_seconds integer default 0,
  p_is_view boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := now();
  v_day date := (v_now at time zone 'Asia/Seoul')::date;
  v_visitor_hash bytea := extensions.digest(p_visitor_id::text, 'sha256');
  v_session_hash bytea := extensions.digest(p_session_id::text, 'sha256');
  v_active integer := greatest(0, least(coalesce(p_active_seconds, 0), 60));
  v_session_exists boolean;
begin
  if p_tab is null or p_tab not in ('lounge', 'desk', 'chain', 'macro', 'game', 'chars') then
    raise exception 'INVALID_TAB';
  end if;

  select exists (
    select 1 from private.site_visit_sessions where session_hash = v_session_hash
  ) into v_session_exists;

  -- Bound anonymous ID rotation so the write-only endpoint cannot grow storage without limit.
  if not v_session_exists and (
    select count(*) from private.site_visit_sessions where started_at > v_now - interval '1 minute'
  ) >= 60 then
    return;
  end if;

  insert into private.site_visitors (visitor_hash, first_seen_at, last_seen_at)
  values (v_visitor_hash, v_now, v_now)
  on conflict (visitor_hash) do update
    set last_seen_at = excluded.last_seen_at;

  insert into private.site_visit_sessions as current_session (
    session_hash, visitor_hash, started_at, last_seen_at, last_event_at, current_tab, active_seconds
  ) values (
    v_session_hash, v_visitor_hash, v_now, v_now, v_now, p_tab, v_active
  )
  on conflict (session_hash) do update set
    last_seen_at = excluded.last_seen_at,
    last_event_at = excluded.last_event_at,
    current_tab = excluded.current_tab,
    active_seconds = least(86400, current_session.active_seconds + v_active);

  insert into private.site_tab_activity as current_activity (
    session_hash, activity_day, tab, first_seen_at, last_seen_at, view_count, active_seconds
  ) values (
    v_session_hash, v_day, p_tab, v_now, v_now, case when p_is_view then 1 else 0 end, v_active
  )
  on conflict (session_hash, activity_day, tab) do update set
    last_seen_at = excluded.last_seen_at,
    view_count = least(10000, current_activity.view_count + case when p_is_view then 1 else 0 end),
    active_seconds = least(86400, current_activity.active_seconds + v_active);
end;
$function$;

revoke all on function public.record_site_activity(uuid, uuid, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.record_site_activity(uuid, uuid, text, integer, boolean) to anon, authenticated;

create or replace function private.rollup_site_analytics(p_day date)
returns void
language plpgsql
set search_path = ''
as $function$
begin
  insert into private.site_analytics_daily (
    day, visitors, new_visitors, returning_visitors, sessions,
    total_active_seconds, average_session_seconds, updated_at
  )
  select
    p_day,
    count(distinct s.visitor_hash)::integer,
    count(distinct s.visitor_hash) filter (
      where (v.first_seen_at at time zone 'Asia/Seoul')::date = p_day
    )::integer,
    count(distinct s.visitor_hash) filter (
      where (v.first_seen_at at time zone 'Asia/Seoul')::date < p_day
    )::integer,
    count(*)::integer,
    coalesce(sum(s.active_seconds), 0)::bigint,
    coalesce(round(avg(s.active_seconds)), 0)::integer,
    now()
  from private.site_visit_sessions s
  join private.site_visitors v on v.visitor_hash = s.visitor_hash
  where (s.started_at at time zone 'Asia/Seoul')::date = p_day
  on conflict (day) do update set
    visitors = excluded.visitors,
    new_visitors = excluded.new_visitors,
    returning_visitors = excluded.returning_visitors,
    sessions = excluded.sessions,
    total_active_seconds = excluded.total_active_seconds,
    average_session_seconds = excluded.average_session_seconds,
    updated_at = excluded.updated_at;

  delete from private.site_analytics_tabs_daily where day = p_day;
  insert into private.site_analytics_tabs_daily (
    day, tab, views, visitors, active_seconds, updated_at
  )
  select
    a.activity_day,
    a.tab,
    sum(a.view_count)::bigint,
    count(distinct s.visitor_hash)::integer,
    sum(a.active_seconds)::bigint,
    now()
  from private.site_tab_activity a
  join private.site_visit_sessions s on s.session_hash = a.session_hash
  where a.activity_day = p_day
  group by a.activity_day, a.tab;
end;
$function$;

create or replace function private.rollup_and_purge_site_analytics()
returns void
language plpgsql
set search_path = ''
as $function$
declare
  v_yesterday date := (now() at time zone 'Asia/Seoul')::date - 1;
begin
  perform private.rollup_site_analytics(v_yesterday);
  delete from private.site_visit_sessions
  where last_seen_at < now() - interval '14 days';
end;
$function$;

revoke all on function private.rollup_site_analytics(date) from public, anon, authenticated;
revoke all on function private.rollup_and_purge_site_analytics() from public, anon, authenticated;

create or replace view private.site_analytics_today
with (security_invoker = true)
as
select
  (now() at time zone 'Asia/Seoul')::date as day,
  count(distinct s.visitor_hash)::integer as visitors,
  count(distinct s.visitor_hash) filter (
    where (v.first_seen_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
  )::integer as new_visitors,
  count(distinct s.visitor_hash) filter (
    where (v.first_seen_at at time zone 'Asia/Seoul')::date < (now() at time zone 'Asia/Seoul')::date
  )::integer as returning_visitors,
  count(*)::integer as sessions,
  coalesce(sum(s.active_seconds), 0)::bigint as total_active_seconds,
  coalesce(round(avg(s.active_seconds)), 0)::integer as average_session_seconds
from private.site_visit_sessions s
join private.site_visitors v on v.visitor_hash = s.visitor_hash
where (s.started_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date;

create or replace view private.site_analytics_tabs_today
with (security_invoker = true)
as
select
  a.activity_day as day,
  a.tab,
  sum(a.view_count)::bigint as views,
  count(distinct s.visitor_hash)::integer as visitors,
  sum(a.active_seconds)::bigint as active_seconds
from private.site_tab_activity a
join private.site_visit_sessions s on s.session_hash = a.session_hash
where a.activity_day = (now() at time zone 'Asia/Seoul')::date
group by a.activity_day, a.tab;

revoke all on private.site_analytics_today from public, anon, authenticated;
revoke all on private.site_analytics_tabs_today from public, anon, authenticated;

do $schedule$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'tape-lounge-analytics-rollup'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  -- 15:15 UTC = 00:15 KST. Roll up the completed KST day, then purge raw sessions.
  perform cron.schedule(
    'tape-lounge-analytics-rollup',
    '15 15 * * *',
    'select private.rollup_and_purge_site_analytics();'
  );
end;
$schedule$;
