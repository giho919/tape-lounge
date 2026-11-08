-- Match database-side external visitor counts to the browser tracker:
-- a first external session is recorded only after five visible seconds.
-- Also filter standard crawlers at the RPC boundary because the RPC is public.
do $migration$
declare
  v_target regprocedure := to_regprocedure('public.record_site_activity(uuid,uuid,text,integer,boolean,text,boolean)');
  v_source text;
  v_before text := $before$  v_internal boolean := coalesce(p_internal, false);
  v_ref text;$before$;
  v_after text := $after$  v_internal boolean := coalesce(p_internal, false);
  v_user_agent text := lower(coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'user-agent', ''));
  v_ref text;$after$;
  v_marker text := '  -- Bound anonymous ID rotation so the write-only endpoint cannot grow storage without limit.';
  v_gate text := $gate$  -- Keep anonymous RPC calls consistent with the five-second visible-page qualification.
  if not v_internal and (
    v_active < 5
    or v_user_agent ~ '(googlebot|google-inspectiontool|googleother|google-agent|storebot-google|bingbot|duckduckbot|baiduspider|yandexbot|applebot|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|redditbot|pinterestbot|ahrefsbot|semrushbot|mj12bot|bytespider|gptbot|claudebot|perplexitybot|crawler|spider|headlesschrome|phantomjs|lighthouse|pagespeed)'
  ) then
    return;
  end if;

$gate$;
begin
  if v_target is null then
    raise exception 'Expected seven-argument site analytics RPC is missing';
  end if;
  v_source := pg_get_functiondef(v_target);
  if strpos(v_source, 'v_user_agent text :=') > 0 then
    if strpos(v_source, 'v_active < 5') = 0 then
      raise exception 'Partial visitor quality gate found; inspect the RPC before upgrading';
    end if;
    return;
  end if;
  if strpos(v_source, v_before) = 0 or strpos(v_source, v_marker) = 0 then
    raise exception 'Site analytics RPC changed; inspect before adding the quality gate';
  end if;
  v_source := replace(v_source, v_before, v_after);
  v_source := replace(v_source, v_marker, v_gate || v_marker);
  execute v_source;
end;
$migration$;

-- Keep daily visitor, tab, and referral summaries aligned with qualified visits.
create or replace function private.rollup_site_analytics(p_day date)
returns void
language plpgsql
set search_path = ''
as $function$
begin
  insert into private.site_analytics_daily (
    day, visitors, new_visitors, returning_visitors, sessions,
    total_active_seconds, average_session_seconds,
    internal_sessions, internal_visitors, updated_at
  )
  select
    p_day,
    count(distinct s.visitor_hash) filter (
      where not s.is_internal and not v.is_internal and s.active_seconds >= 5
    )::integer,
    count(distinct s.visitor_hash) filter (
      where not s.is_internal and not v.is_internal and s.active_seconds >= 5
        and (v.first_seen_at at time zone 'Asia/Seoul')::date = p_day
    )::integer,
    count(distinct s.visitor_hash) filter (
      where not s.is_internal and not v.is_internal and s.active_seconds >= 5
        and (v.first_seen_at at time zone 'Asia/Seoul')::date < p_day
    )::integer,
    count(*) filter (
      where not s.is_internal and not v.is_internal and s.active_seconds >= 5
    )::integer,
    coalesce(sum(s.active_seconds) filter (
      where not s.is_internal and not v.is_internal and s.active_seconds >= 5
    ), 0)::bigint,
    coalesce(round(avg(s.active_seconds) filter (
      where not s.is_internal and not v.is_internal and s.active_seconds >= 5
    )), 0)::integer,
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
    internal_sessions = excluded.internal_sessions,
    internal_visitors = excluded.internal_visitors,
    updated_at = excluded.updated_at;

  delete from private.site_analytics_tabs_daily where day = p_day;
  with qualified_session_days as (
    select session_hash, activity_day
    from private.site_tab_activity
    group by session_hash, activity_day
    having sum(active_seconds) >= 5
  )
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
  join qualified_session_days q on q.session_hash = a.session_hash and q.activity_day = a.activity_day
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
    and not s.is_internal and not v.is_internal and s.active_seconds >= 5
    and s.referrer_host is not null
  group by s.referrer_host;
end;
$function$;

-- Campaign attribution summaries use the same qualified-session definition.
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
  where not s.is_internal and not v.is_internal and s.active_seconds >= 5
    and s.campaign_source is not null
  group by a.activity_day, s.session_hash, s.visitor_hash, s.campaign_source, s.campaign_name
  having sum(a.active_seconds) >= 5
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

-- Rebuild summaries only for days with retained raw sessions; older rolled-up
-- history whose raw sessions were already purged remains intact.
do $refresh$
declare
  v_day date;
begin
  for v_day in
    select distinct (s.started_at at time zone 'Asia/Seoul')::date
    from private.site_visit_sessions s
    where (s.started_at at time zone 'Asia/Seoul')::date < (now() at time zone 'Asia/Seoul')::date
    order by 1
  loop
    perform private.rollup_site_analytics(v_day);
    perform private.rollup_site_campaigns(v_day);
  end loop;
end;
$refresh$;

-- Keep the live overview and tab views on the same qualification rule as daily rollups.
create or replace view private.site_analytics_today as
select
  (now() at time zone 'Asia/Seoul')::date as day,
  count(distinct s.visitor_hash) filter (
    where not s.is_internal and not v.is_internal and s.active_seconds >= 5
  )::integer as visitors,
  count(distinct s.visitor_hash) filter (
    where not s.is_internal and not v.is_internal and s.active_seconds >= 5
      and (v.first_seen_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
  )::integer as new_visitors,
  count(distinct s.visitor_hash) filter (
    where not s.is_internal and not v.is_internal and s.active_seconds >= 5
      and (v.first_seen_at at time zone 'Asia/Seoul')::date < (now() at time zone 'Asia/Seoul')::date
  )::integer as returning_visitors,
  count(*) filter (
    where not s.is_internal and not v.is_internal and s.active_seconds >= 5
  )::integer as sessions,
  coalesce(sum(s.active_seconds) filter (
    where not s.is_internal and not v.is_internal and s.active_seconds >= 5
  ), 0::bigint) as total_active_seconds,
  coalesce(round(avg(s.active_seconds) filter (
    where not s.is_internal and not v.is_internal and s.active_seconds >= 5
  )), 0::numeric)::integer as average_session_seconds,
  count(*) filter (where s.is_internal or v.is_internal)::integer as internal_sessions
from private.site_visit_sessions s
join private.site_visitors v on v.visitor_hash = s.visitor_hash
where (s.started_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date;

create or replace view private.site_analytics_tabs_today as
with qualified_session_days as (
  select session_hash, activity_day
  from private.site_tab_activity
  group by session_hash, activity_day
  having sum(active_seconds) >= 5
)
select
  a.activity_day as day,
  a.tab,
  sum(a.view_count)::bigint as views,
  count(distinct s.visitor_hash)::integer as visitors,
  sum(a.active_seconds)::bigint as active_seconds
from private.site_tab_activity a
join private.site_visit_sessions s on s.session_hash = a.session_hash
join private.site_visitors v on v.visitor_hash = s.visitor_hash
join qualified_session_days q on q.session_hash = a.session_hash and q.activity_day = a.activity_day
where a.activity_day = (now() at time zone 'Asia/Seoul')::date
  and not s.is_internal and not v.is_internal
  and s.active_seconds >= 5
group by a.activity_day, a.tab;
