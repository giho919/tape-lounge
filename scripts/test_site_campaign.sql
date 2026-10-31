-- Real-role integration checks. All synthetic sessions, metadata and rollups roll back.
begin isolation level repeatable read;
do $test$
declare
  v_visitor uuid := gen_random_uuid();
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();
  v_internal uuid := gen_random_uuid();
  v_untagged uuid := gen_random_uuid();
  v_invalid uuid := gen_random_uuid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_role text := current_user;
  v_name text := 'site_launch_19000101';
  v_other text := 'daily_blind_19000101';
  v_rejected boolean;
  v_count integer;
  v_row record;
  v_public_role text;
begin
  foreach v_public_role in array array['anon','authenticated'] loop
    if not has_function_privilege(v_public_role,'public.record_site_campaign_activity(uuid,uuid,text,integer,boolean,text,boolean,text,text)','execute') then
      raise exception 'Expected campaign write-only caller lost execute';
    end if;
    if has_table_privilege(v_public_role,'private.site_visit_sessions','select,insert,update,delete')
      or has_table_privilege(v_public_role,'private.site_analytics_campaigns_recent','select')
      or has_table_privilege(v_public_role,'private.site_analytics_campaigns_today','select')
      or has_table_privilege(v_public_role,'private.site_analytics_campaigns_daily','select,insert,update,delete') then
      raise exception 'Raw/private aggregate access leaked';
    end if;
  end loop;

  execute 'set local role anon';
  perform public.record_site_campaign_activity(v_visitor,v_a,'analysis',20,true,'campaign-check.invalid',false,'threads',v_name);
  execute format('set local role %I',v_role);
  perform public.record_site_campaign_activity(v_visitor,v_a,'lounge',20,true,null,false,'x',v_other);
  perform public.record_site_activity(v_visitor,v_a,'analysis',0,true,null,false);
  perform public.record_site_campaign_activity(v_visitor,v_b,'domestic',35,true,'campaign-check.invalid',false,'threads',v_name);
  perform public.record_site_campaign_activity(v_visitor,v_c,'game',0,true,'campaign-check.invalid',false,'x',v_other);

  if not exists(select 1 from private.site_visit_sessions where session_hash=extensions.digest(v_a::text,'sha256') and campaign_source='threads' and campaign_name=v_name) then
    raise exception 'First campaign was replaced by later tab activity';
  end if;
  select * into v_row from private.site_analytics_campaigns_today where campaign_source='threads' and campaign_name=v_name;
  if not found or v_row.visitors is distinct from 1 or v_row.sessions is distinct from 2 or v_row.active_seconds is distinct from 75::bigint or v_row.engaged_sessions is distinct from 2 then
    raise exception 'Campaign visitor/session/tab deduplication or engagement failed: %',to_jsonb(v_row);
  end if;
  if not exists(select 1 from private.site_analytics_campaigns_today where campaign_source='x' and campaign_name=v_other and visitors=1 and sessions=1 and active_seconds=0) then
    raise exception 'Distinct source/campaign aggregation failed';
  end if;

  perform public.record_site_campaign_activity(gen_random_uuid(),v_internal,'game',99999,true,'campaign-check.invalid',true,'threads',v_name);
  perform public.record_site_campaign_activity(v_visitor,v_internal,'analysis',30,true,null,false,'threads',v_name);
  if not exists(select 1 from private.site_visit_sessions where session_hash=extensions.digest(v_internal::text,'sha256') and is_internal and active_seconds=90 and campaign_source is null) then
    raise exception 'Duration cap or sticky internal exclusion failed';
  end if;
  if coalesce((select sessions from private.site_analytics_campaigns_today where campaign_source='threads' and campaign_name=v_name),-1)<>2 then
    raise exception 'Internal campaign visit changed external totals';
  end if;

  -- Existing untagged requests remain valid; another visitor cannot attach metadata to that session.
  perform public.record_site_activity(v_visitor,v_untagged,'lounge',0,true,'campaign-check.invalid',false);
  perform public.record_site_campaign_activity(gen_random_uuid(),v_untagged,'lounge',0,true,null,false,'threads',v_name);
  if exists(select 1 from private.site_visit_sessions where session_hash=extensions.digest(v_untagged::text,'sha256') and campaign_source is not null) then
    raise exception 'Campaign was attached to a mismatching visitor/session pair';
  end if;
  v_rejected:=false;
  begin
    perform public.record_site_campaign_activity(gen_random_uuid(),v_invalid,'lounge',0,true,'campaign-check.invalid',false,'threads','private-arbitrary-value');
  exception when others then
    if sqlerrm<>'INVALID_CAMPAIGN' then raise;end if;v_rejected:=true;
  end;
  if not v_rejected or exists(select 1 from private.site_visit_sessions where session_hash=extensions.digest(v_invalid::text,'sha256')) then
    raise exception 'Invalid campaign must fail before recording any visit';
  end if;
  v_rejected:=false;
  begin
    update private.site_visit_sessions set campaign_name=v_name where session_hash=extensions.digest(v_untagged::text,'sha256');
  exception when check_violation then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Incomplete campaign label pair was accepted';end if;

  -- An overnight session must count on its actual activity day, not solely its start day.
  update private.site_visit_sessions set started_at=now()-interval '1 day' where session_hash=extensions.digest(v_a::text,'sha256');
  insert into private.site_tab_activity(session_hash,activity_day,tab,first_seen_at,last_seen_at,view_count,active_seconds)
  values(extensions.digest(v_a::text,'sha256'),v_today-1,'analysis',now()-interval '1 day',now()-interval '1 day',1,12);
  if coalesce((select sessions from private.site_analytics_campaigns_today where campaign_source='threads' and campaign_name=v_name),-1)<>2 then
    raise exception 'Overnight session disappeared from today';
  end if;
  perform private.rollup_site_campaigns(v_today-1);
  perform private.rollup_site_campaigns(v_today-1);
  if not exists(select 1 from private.site_analytics_campaigns_daily where day=v_today-1 and campaign_source='threads' and campaign_name=v_name and visitors=1 and sessions=1 and active_seconds=12) then
    raise exception 'Daily campaign rollup/re-run failed';
  end if;

  -- Fill remaining anonymous new-session slots; the wrapper must not bypass the existing cap.
  select count(*) into v_count from private.site_visit_sessions where started_at>now()-interval '1 minute';
  for i in 1..greatest(0,60-v_count) loop
    perform public.record_site_activity(gen_random_uuid(),gen_random_uuid(),'lounge',0,false,'campaign-check.invalid',true);
  end loop;
  v_invalid:=gen_random_uuid();
  perform public.record_site_campaign_activity(gen_random_uuid(),v_invalid,'lounge',0,true,'campaign-check.invalid',false,'x',v_other);
  if exists(select 1 from private.site_visit_sessions where session_hash=extensions.digest(v_invalid::text,'sha256')) then
    raise exception 'Campaign wrapper bypassed the anonymous session cap';
  end if;
end;
$test$;
rollback;
