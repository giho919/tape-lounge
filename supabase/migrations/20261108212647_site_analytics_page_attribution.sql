-- Store only a fixed, query-free page key alongside qualified sessions.
-- This makes landing-page/referral analysis possible without retaining URLs,
-- query parameters, fragments, or user-provided path segments.

alter table private.site_visit_sessions
  add column page_key text,
  add constraint site_visit_sessions_page_key_check check (
    page_key is null or page_key = any (array[
      'lounge','blind','decision','desk','onchain','calendar','analysis','domestic',
      'strategists','markets','watch','research','about','learn_index',
      'learn_bitcoin_decision_practice','learn_blind_chart_practice',
      'learn_kimchi_premium','learn_market_sessions','learn_trend_retest',
      'report_andy_scan','report_justin_lab','report_madam_daily','other'
    ]::text[])
  );

create table private.site_analytics_pages_daily (
  day date not null,
  page_key text not null check (page_key = any (array[
    'lounge','blind','decision','desk','onchain','calendar','analysis','domestic',
    'strategists','markets','watch','research','about','learn_index',
    'learn_bitcoin_decision_practice','learn_blind_chart_practice',
    'learn_kimchi_premium','learn_market_sessions','learn_trend_retest',
    'report_andy_scan','report_justin_lab','report_madam_daily','other'
  ]::text[])),
  visitors integer not null check (visitors >= 0),
  sessions integer not null check (sessions >= 0),
  active_seconds bigint not null check (active_seconds >= 0),
  engaged_sessions integer not null check (engaged_sessions >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, page_key)
);

alter table private.site_analytics_pages_daily enable row level security;
revoke all on private.site_analytics_pages_daily from public, anon, authenticated;

create or replace function private.rollup_site_pages(p_day date)
returns void
language plpgsql
set search_path = ''
as $function$
begin
  delete from private.site_analytics_pages_daily where day = p_day;

  with qualified_session_days as (
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
      and s.active_seconds >= 5
      and not s.is_internal
      and not v.is_internal
    group by a.activity_day, s.session_hash, s.visitor_hash, s.page_key
    having sum(a.active_seconds) >= 5
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
  from qualified_session_days
  group by day, page_key;
end;
$function$;
revoke all on function private.rollup_site_pages(date) from public, anon, authenticated;

create or replace view private.site_analytics_pages_today
with (security_invoker = true)
as
with qualified_session_days as (
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
    and s.active_seconds >= 5
    and not s.is_internal
    and not v.is_internal
  group by a.activity_day, s.session_hash, s.visitor_hash, s.page_key
  having sum(a.active_seconds) >= 5
)
select
  day,
  page_key,
  count(distinct visitor_hash)::integer as visitors,
  count(*)::integer as sessions,
  coalesce(sum(active_seconds), 0)::bigint as active_seconds,
  count(*) filter (where active_seconds >= 30)::integer as engaged_sessions
from qualified_session_days
group by day, page_key;

revoke all on private.site_analytics_pages_today from public, anon, authenticated;

-- The new helper schema is not exposed through PostgREST. Its only callable
-- function can update a fixed page key on the caller's own hashed session.
create schema if not exists analytics_internal;
revoke all on schema analytics_internal from public, anon, authenticated;
grant usage on schema analytics_internal to anon, authenticated;

create or replace function analytics_internal.set_site_session_page(
  p_visitor_id uuid,
  p_session_id uuid,
  p_page_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_page_key is null or p_page_key not in (
    'lounge','blind','decision','desk','onchain','calendar','analysis','domestic',
    'strategists','markets','watch','research','about','learn_index',
    'learn_bitcoin_decision_practice','learn_blind_chart_practice',
    'learn_kimchi_premium','learn_market_sessions','learn_trend_retest',
    'report_andy_scan','report_justin_lab','report_madam_daily','other'
  ) then
    raise exception 'INVALID_PAGE_KEY';
  end if;

  update private.site_visit_sessions
  set page_key = p_page_key
  where session_hash = extensions.digest(p_session_id::text, 'sha256')
    and visitor_hash = extensions.digest(p_visitor_id::text, 'sha256')
    and page_key is null
    and not is_internal;
end;
$function$;
revoke all on function analytics_internal.set_site_session_page(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function analytics_internal.set_site_session_page(uuid, uuid, text)
  to anon, authenticated;

-- Keep old RPCs intact for cached clients. New clients use thin invoker wrappers;
-- the legacy analytics endpoint still owns qualification, bot filtering and rate limits.
create or replace function public.record_site_activity_page(
  p_visitor_id uuid,
  p_session_id uuid,
  p_tab text,
  p_active_seconds integer,
  p_is_view boolean,
  p_referrer_host text,
  p_internal boolean,
  p_page_key text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  perform public.record_site_activity(
    p_visitor_id, p_session_id, p_tab, p_active_seconds, p_is_view,
    p_referrer_host, p_internal
  );
  perform analytics_internal.set_site_session_page(p_visitor_id, p_session_id, p_page_key);
end;
$function$;
revoke all on function public.record_site_activity_page(uuid, uuid, text, integer, boolean, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_site_activity_page(uuid, uuid, text, integer, boolean, text, boolean, text)
  to anon, authenticated;

create or replace function public.record_site_campaign_activity_page(
  p_visitor_id uuid,
  p_session_id uuid,
  p_tab text,
  p_active_seconds integer,
  p_is_view boolean,
  p_referrer_host text,
  p_internal boolean,
  p_campaign_source text,
  p_campaign_name text,
  p_page_key text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  perform public.record_site_campaign_activity(
    p_visitor_id, p_session_id, p_tab, p_active_seconds, p_is_view,
    p_referrer_host, p_internal, p_campaign_source, p_campaign_name
  );
  perform analytics_internal.set_site_session_page(p_visitor_id, p_session_id, p_page_key);
end;
$function$;
revoke all on function public.record_site_campaign_activity_page(uuid, uuid, text, integer, boolean, text, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_site_campaign_activity_page(uuid, uuid, text, integer, boolean, text, boolean, text, text, text)
  to anon, authenticated;

-- Page-level historical counts must be stored before the existing 14-day raw purge.
do $patch$
declare
  v_definition text := pg_get_functiondef('private.rollup_and_purge_site_analytics()'::regprocedure);
  v_marker text := '  perform private.rollup_site_campaigns(v_yesterday);';
  v_replacement text := v_marker || E'\n  perform private.rollup_site_pages(v_yesterday);';
begin
  if strpos(v_definition, 'rollup_site_pages(v_yesterday)') > 0 then
    null;
  elsif strpos(v_definition, v_marker) = 0 then
    raise exception 'Unexpected site analytics maintenance function; inspect before patching';
  else
    execute replace(v_definition, v_marker, v_replacement);
  end if;
end;
$patch$;

notify pgrst, 'reload schema';
