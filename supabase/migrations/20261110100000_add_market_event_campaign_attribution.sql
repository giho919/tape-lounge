-- Add a fixed label for verified macro and market-event promotion links.
-- Preserve the existing social sources and the built-in share campaign pairs.
alter table private.site_visit_sessions
  drop constraint site_visit_sessions_campaign_check,
  add constraint site_visit_sessions_campaign_check check (
    (campaign_source is null and campaign_name is null) or
    (campaign_source is not null and campaign_name is not null and (
      (campaign_source in ('threads','x','instagram') and campaign_name ~
        '^(andy_scan|kimchi_fx|session_championship|daily_blind|site_launch|market_event)(_[0-9]{8})?$') or
      (campaign_source = 'share' and campaign_name in ('decision_game','daily_blind'))
    ))
  );

alter table private.site_analytics_campaigns_daily
  drop constraint site_analytics_campaigns_daily_campaign_pair_check,
  add constraint site_analytics_campaigns_daily_campaign_pair_check check (
    (campaign_source is null and campaign_name is null) or
    (campaign_source is not null and campaign_name is not null and (
      (campaign_source in ('threads','x','instagram') and campaign_name ~
        '^(andy_scan|kimchi_fx|session_championship|daily_blind|site_launch|market_event)(_[0-9]{8})?$') or
      (campaign_source = 'share' and campaign_name in ('decision_game','daily_blind'))
    ))
  );

create or replace function public.record_site_campaign_activity(
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
  if p_campaign_source is null or p_campaign_name is null or not (
    (p_campaign_source in ('threads','x','instagram') and p_campaign_name ~
      '^(andy_scan|kimchi_fx|session_championship|daily_blind|site_launch|market_event)(_[0-9]{8})?$') or
    (p_campaign_source = 'share' and p_campaign_name in ('decision_game','daily_blind'))
  ) then
    raise exception 'INVALID_CAMPAIGN';
  end if;
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
