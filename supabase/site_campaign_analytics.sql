-- Reviewed SQL snapshot for the recorded add_site_campaign_attribution migration.
-- Additive to the deployed seven-argument analytics RPC; do not replay the old bootstrap.
alter table private.site_visit_sessions
  add column campaign_source text,
  add column campaign_name text,
  add constraint site_visit_sessions_campaign_check check (
    (campaign_source is null and campaign_name is null) or
    (campaign_source is not null and campaign_source in ('threads','x') and campaign_name is not null
      and campaign_name ~ '^(andy_scan|kimchi_fx|session_championship|daily_blind|site_launch)(_[0-9]{8})?$')
  );

-- Separate endpoint avoids overloaded RPC resolution and preserves cached old clients.
create function public.record_site_campaign_activity(
  p_visitor_id uuid, p_session_id uuid, p_tab text,
  p_active_seconds integer, p_is_view boolean, p_referrer_host text, p_internal boolean,
  p_campaign_source text, p_campaign_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_campaign_source is null or p_campaign_source not in ('threads','x')
     or p_campaign_name is null
     or p_campaign_name !~ '^(andy_scan|kimchi_fx|session_championship|daily_blind|site_launch)(_[0-9]{8})?$' then
    raise exception 'INVALID_CAMPAIGN';
  end if;
  -- All validation, rate limits, duration caps and sticky internal handling stay in one place.
  perform public.record_site_activity(p_visitor_id,p_session_id,p_tab,p_active_seconds,p_is_view,p_referrer_host,p_internal);
  update private.site_visit_sessions
  set campaign_source=p_campaign_source, campaign_name=p_campaign_name
  where session_hash=extensions.digest(p_session_id::text,'sha256')
    and visitor_hash=extensions.digest(p_visitor_id::text,'sha256')
    and not is_internal and campaign_source is null and campaign_name is null;
end;
$function$;
revoke all on function public.record_site_campaign_activity(uuid,uuid,text,integer,boolean,text,boolean,text,text) from public;
grant execute on function public.record_site_campaign_activity(uuid,uuid,text,integer,boolean,text,boolean,text,text) to anon,authenticated;

-- Deduplicate sessions before grouping: visiting multiple tabs must not multiply visits.
-- Use the actual KST activity day, including a tab kept open across midnight.
create view private.site_analytics_campaigns_recent with (security_invoker=true) as
with session_days as (
  select a.activity_day as day,s.session_hash,s.visitor_hash,s.campaign_source,s.campaign_name,
    least(86400,sum(a.active_seconds))::bigint as active_seconds
  from private.site_tab_activity a
  join private.site_visit_sessions s on s.session_hash=a.session_hash
  where not s.is_internal and s.campaign_source is not null
  group by a.activity_day,s.session_hash,s.visitor_hash,s.campaign_source,s.campaign_name
)
select day,campaign_source,campaign_name,count(distinct visitor_hash)::integer as visitors,
  count(*)::integer as sessions,sum(active_seconds)::bigint as active_seconds,
  count(*) filter (where active_seconds>=30)::integer as engaged_sessions
from session_days group by day,campaign_source,campaign_name;

create view private.site_analytics_campaigns_today with (security_invoker=true) as
select * from private.site_analytics_campaigns_recent
where day=(now() at time zone 'Asia/Seoul')::date;

create table private.site_analytics_campaigns_daily (
  day date not null,
  campaign_source text not null check (campaign_source in ('threads','x')),
  campaign_name text not null check (campaign_name ~ '^(andy_scan|kimchi_fx|session_championship|daily_blind|site_launch)(_[0-9]{8})?$'),
  visitors integer not null check (visitors>=0),
  sessions integer not null check (sessions>=0),
  active_seconds bigint not null check (active_seconds>=0),
  engaged_sessions integer not null check (engaged_sessions>=0),
  updated_at timestamptz not null default now(),
  primary key (day,campaign_source,campaign_name)
);
alter table private.site_analytics_campaigns_daily enable row level security;
revoke all on private.site_analytics_campaigns_recent,private.site_analytics_campaigns_today,
  private.site_analytics_campaigns_daily from public,anon,authenticated;

create function private.rollup_site_campaigns(p_day date)
returns void language plpgsql set search_path='' as $function$
begin
  delete from private.site_analytics_campaigns_daily where day=p_day;
  insert into private.site_analytics_campaigns_daily
    (day,campaign_source,campaign_name,visitors,sessions,active_seconds,engaged_sessions)
  select day,campaign_source,campaign_name,visitors,sessions,active_seconds,engaged_sessions
  from private.site_analytics_campaigns_recent where day=p_day;
end;
$function$;
revoke all on function private.rollup_site_campaigns(date) from public,anon,authenticated;

-- Add the new aggregate before the existing raw-session purge, preserving owner/ACL.
do $patch$
declare
  v_definition text := pg_get_functiondef('private.rollup_and_purge_site_analytics()'::regprocedure);
  v_original text := E'  perform private.rollup_site_analytics(v_yesterday);\n';
begin
  if strpos(v_definition,v_original)=0 or strpos(v_definition,'rollup_site_campaigns')>0 then
    raise exception 'Unexpected analytics maintenance definition; inspect before upgrading';
  end if;
  execute replace(v_definition,v_original,v_original||E'  perform private.rollup_site_campaigns(v_yesterday);\n');
end;
$patch$;
