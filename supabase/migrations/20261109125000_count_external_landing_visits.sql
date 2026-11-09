-- Count a browser landing as a visit immediately. Engagement remains a separate
-- metric (30+ active seconds); short visits must not disappear from acquisition.
do $migration$
declare
  v_target regprocedure := to_regprocedure(
    'public.record_site_activity(uuid,uuid,text,integer,boolean,text,boolean)'
  );
  v_source text;
  v_before constant text :=
    'v_active < 5 and not (coalesce(p_is_view, false) and v_active = 0 and v_session_exists)';
begin
  if v_target is null then
    raise exception 'Expected public.record_site_activity signature was not found';
  end if;

  v_source := pg_get_functiondef(v_target);
  if strpos(v_source, v_before) > 0 then
    v_source := replace(v_source, v_before, 'false /* no visit-length gate */');
    v_source := replace(
      v_source,
      '-- Keep anonymous RPC calls consistent with the five-second visible-page qualification.',
      '-- Landing views are recorded immediately; short sessions remain measurable.'
    );
    execute v_source;
  elsif strpos(v_source, 'v_active < 5') > 0 then
    raise exception 'Unexpected visit qualification gate; inspect before upgrading';
  elsif strpos(v_source, 'v_user_agent text :=') = 0 then
    raise exception 'Expected browser bot filter was not found';
  end if;
end;
$migration$;

-- Preserve the engagement-quality signal after raw sessions are purged.
alter table private.site_analytics_daily
  add column if not exists engaged_sessions integer;

create or replace function private.rollup_site_analytics(p_day date)
returns void
language plpgsql
set search_path = ''
as $function$
begin
  insert into private.site_analytics_daily (
    day, visitors, new_visitors, returning_visitors, sessions,
    total_active_seconds, average_session_seconds, engaged_sessions,
    internal_sessions, internal_visitors, updated_at
  )
  select
    p_day,
    count(distinct s.visitor_hash) filter (
      where not s.is_internal and not v.is_internal
    )::integer,
    count(distinct s.visitor_hash) filter (
      where not s.is_internal and not v.is_internal
        and (v.first_seen_at at time zone 'Asia/Seoul')::date = p_day
    )::integer,
    count(distinct s.visitor_hash) filter (
      where not s.is_internal and not v.is_internal
        and (v.first_seen_at at time zone 'Asia/Seoul')::date < p_day
    )::integer,
    count(*) filter (where not s.is_internal and not v.is_internal)::integer,
    coalesce(sum(s.active_seconds) filter (
      where not s.is_internal and not v.is_internal
    ), 0)::bigint,
    coalesce(round(avg(s.active_seconds) filter (
      where not s.is_internal and not v.is_internal
    )), 0)::integer,
    count(*) filter (
      where not s.is_internal and not v.is_internal and s.active_seconds >= 30
    )::integer,
    count(*) filter (where s.is_internal or v.is_internal)::integer,
    count(distinct s.visitor_hash) filter (where s.is_internal or v.is_internal)::integer,
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
    engaged_sessions = excluded.engaged_sessions,
    internal_sessions = excluded.internal_sessions,
    internal_visitors = excluded.internal_visitors,
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
  join private.site_visitors v on v.visitor_hash = s.visitor_hash
  where a.activity_day = p_day
    and not s.is_internal and not v.is_internal
  group by a.activity_day, a.tab;

  delete from private.site_analytics_referrers_daily where day = p_day;
  insert into private.site_analytics_referrers_daily (
    day, referrer_host, sessions, visitors, updated_at
  )
  select
    p_day,
    s.referrer_host,
    count(*)::integer,
    count(distinct s.visitor_hash)::integer,
    now()
  from private.site_visit_sessions s
  join private.site_visitors v on v.visitor_hash = s.visitor_hash
  where (s.started_at at time zone 'Asia/Seoul')::date = p_day
    and not s.is_internal and not v.is_internal
    and s.referrer_host is not null
  group by s.referrer_host;
end;
$function$;

create or replace view private.site_analytics_today
with (security_invoker = true)
as
select
  (now() at time zone 'Asia/Seoul')::date as day,
  count(distinct s.visitor_hash) filter (
    where not s.is_internal and not v.is_internal
  )::integer as visitors,
  count(distinct s.visitor_hash) filter (
    where not s.is_internal and not v.is_internal
      and (v.first_seen_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
  )::integer as new_visitors,
  count(distinct s.visitor_hash) filter (
    where not s.is_internal and not v.is_internal
      and (v.first_seen_at at time zone 'Asia/Seoul')::date < (now() at time zone 'Asia/Seoul')::date
  )::integer as returning_visitors,
  count(*) filter (where not s.is_internal and not v.is_internal)::integer as sessions,
  coalesce(sum(s.active_seconds) filter (
    where not s.is_internal and not v.is_internal
  ), 0::bigint) as total_active_seconds,
  coalesce(round(avg(s.active_seconds) filter (
    where not s.is_internal and not v.is_internal
  )), 0::numeric)::integer as average_session_seconds,
  count(*) filter (where s.is_internal or v.is_internal)::integer as internal_sessions,
  count(*) filter (
    where not s.is_internal and not v.is_internal and s.active_seconds >= 30
  )::integer as engaged_sessions
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
join private.site_visitors v on v.visitor_hash = s.visitor_hash
where a.activity_day = (now() at time zone 'Asia/Seoul')::date
  and not s.is_internal and not v.is_internal
group by a.activity_day, a.tab;

create or replace function private.rollup_site_pages(p_day date)
returns void
language plpgsql
set search_path = ''
as $function$
begin
  delete from private.site_analytics_pages_daily where day = p_day;

  with page_sessions as (
    select
      a.activity_day as day,
      s.session_hash,
      s.visitor_hash,
      s.page_key,
      least(86400, sum(a.active_seconds))::bigint as active_seconds
    from private.site_tab_activity a
    join private.site_visit_sessions s on s.session_hash = a.session_hash
    join private.site_visitors v on v.visitor_hash = s.visitor_hash
    where a.activity_day = p_day
      and s.page_key is not null
      and not s.is_internal
      and not v.is_internal
    group by a.activity_day, s.session_hash, s.visitor_hash, s.page_key
  )
  insert into private.site_analytics_pages_daily (
    day, page_key, visitors, sessions, active_seconds, engaged_sessions, updated_at
  )
  select
    day,
    page_key,
    count(distinct visitor_hash)::integer,
    count(*)::integer,
    coalesce(sum(active_seconds), 0)::bigint,
    count(*) filter (where active_seconds >= 30)::integer,
    now()
  from page_sessions
  group by day, page_key;
end;
$function$;

create or replace view private.site_analytics_pages_today
with (security_invoker = true)
as
with page_sessions as (
  select
    a.activity_day as day,
    s.session_hash,
    s.visitor_hash,
    s.page_key,
    least(86400, sum(a.active_seconds))::bigint as active_seconds
  from private.site_tab_activity a
  join private.site_visit_sessions s on s.session_hash = a.session_hash
  join private.site_visitors v on v.visitor_hash = s.visitor_hash
  where a.activity_day = (now() at time zone 'Asia/Seoul')::date
    and s.page_key is not null
    and not s.is_internal
    and not v.is_internal
  group by a.activity_day, s.session_hash, s.visitor_hash, s.page_key
)
select
  day,
  page_key,
  count(distinct visitor_hash)::integer as visitors,
  count(*)::integer as sessions,
  coalesce(sum(active_seconds), 0)::bigint as active_seconds,
  count(*) filter (where active_seconds >= 30)::integer as engaged_sessions
from page_sessions
group by day, page_key;

create or replace view private.site_analytics_campaigns_recent
with (security_invoker = true)
as
with session_days as (
  select
    a.activity_day as day,
    s.session_hash,
    s.visitor_hash,
    s.campaign_source,
    s.campaign_name,
    least(86400, sum(a.active_seconds))::bigint as active_seconds
  from private.site_tab_activity a
  join private.site_visit_sessions s on s.session_hash = a.session_hash
  join private.site_visitors v on v.visitor_hash = s.visitor_hash
  where not s.is_internal and not v.is_internal
    and s.campaign_source is not null
  group by a.activity_day, s.session_hash, s.visitor_hash, s.campaign_source, s.campaign_name
)
select
  day,
  campaign_source,
  campaign_name,
  count(distinct visitor_hash)::integer as visitors,
  count(*)::integer as sessions,
  sum(active_seconds)::bigint as active_seconds,
  count(*) filter (where active_seconds >= 30)::integer as engaged_sessions
from session_days
group by day, campaign_source, campaign_name;

-- Recalculate the retained period under the new definition. Older daily rows
-- remain as originally measured because their raw browser sessions were purged.
do $refresh$
declare
  v_day date;
begin
  for v_day in
    select distinct (s.started_at at time zone 'Asia/Seoul')::date
    from private.site_visit_sessions s
    order by 1
  loop
    perform private.rollup_site_analytics(v_day);
    perform private.rollup_site_pages(v_day);
    perform private.rollup_site_campaigns(v_day);
  end loop;
end;
$refresh$;

notify pgrst, 'reload schema';
