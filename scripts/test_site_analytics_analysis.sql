-- Integration assertions on the real RPC, with no committed synthetic visits.
-- Run as the database administrator. Every assertion and row is rolled back.
begin isolation level repeatable read;
do $test$
declare
  v_visitor uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_hash bytea := extensions.digest(v_session::text, 'sha256');
  v_target regprocedure := 'public.record_site_activity(uuid,uuid,text,integer,boolean,text,boolean)'::regprocedure;
  v_original_role text := current_user;
  v_before jsonb;
  v_after jsonb;
  v_external_visitor uuid := gen_random_uuid();
  v_analysis_before integer;
  v_tab text;
  v_role text;
  v_rejected boolean := false;
begin
  select to_jsonb(t)-'internal_sessions' into v_before from private.site_analytics_today t;
  foreach v_role in array array['anon','authenticated'] loop
    if not has_function_privilege(v_role, v_target, 'execute') then
      raise exception 'Expected public RPC caller lost access: %', v_role;
    end if;
    if has_table_privilege(v_role, 'private.site_visit_sessions', 'select,insert,update,delete')
       or has_table_privilege(v_role, 'private.site_tab_activity', 'select,insert,update,delete') then
      raise exception 'Private analytics tables must not be publicly readable or writable';
    end if;
  end loop;

  -- Exercise the actual anonymous-caller privilege boundary.
  execute 'set local role anon';
  perform public.record_site_activity(v_visitor, v_session, 'analysis', 30, true, 'analytics-check.invalid', true);
  execute format('set local role %I', v_original_role);
  -- Switching tabs must reuse the visitor and session; internal status is sticky.
  perform public.record_site_activity(v_visitor, v_session, 'lounge', 99999, true, null, false);
  perform public.record_site_activity(v_visitor, v_session, 'analysis', 15, false, null, false);

  if not exists(select 1 from private.site_visit_sessions where session_hash=v_hash
      and current_tab='analysis' and active_seconds=105 and is_internal
      and referrer_host='analytics-check.invalid') then
    raise exception 'Analysis/session tracking, duration cap or internal exclusion failed';
  end if;
  if not exists(select 1 from private.site_tab_activity where session_hash=v_hash
      and tab='analysis' and view_count=1 and active_seconds=45) then
    raise exception 'Analysis tab activity or view count was not recorded correctly';
  end if;
  if (select count(*) from private.site_visit_sessions where visitor_hash=extensions.digest(v_visitor::text,'sha256'))<>1 then
    raise exception 'Changing tabs created duplicate sessions';
  end if;
  select to_jsonb(t)-'internal_sessions' into v_after from private.site_analytics_today t;
  if v_before is distinct from v_after then
    raise exception 'Internal verification changed external audience totals';
  end if;

  foreach v_tab in array array['lounge','domestic','desk','analysis','chain','macro','game','chars'] loop
    perform public.record_site_activity(v_visitor,v_session,v_tab,0,false,null,true);
  end loop;
  begin
    perform public.record_site_activity(v_visitor,v_session,'not-a-real-tab',0,false,null,true);
  exception when others then
    if sqlerrm <> 'INVALID_TAB' then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Unknown tabs must still be rejected'; end if;

  -- An external analysis visit must count once, even with two browser sessions.
  select coalesce((select visitors from private.site_analytics_tabs_today where tab='analysis'),0)
    into v_analysis_before;
  perform public.record_site_activity(v_external_visitor,gen_random_uuid(),'analysis',10,true,'analytics-check.invalid',false);
  perform public.record_site_activity(v_external_visitor,gen_random_uuid(),'lounge',0,true,'analytics-check.invalid',false);
  select to_jsonb(t)-'internal_sessions' into v_after from private.site_analytics_today t;
  if (v_after->>'visitors')::integer <> (v_before->>'visitors')::integer+1
     or (v_after->>'sessions')::integer <> (v_before->>'sessions')::integer+2 then
    raise exception 'External analysis visits or unique-browser deduplication failed';
  end if;
  if not exists(select 1 from private.site_analytics_tabs_today
      where tab='analysis' and visitors=v_analysis_before+1) then
    raise exception 'External analysis visit is absent from the private tab aggregate';
  end if;
end;
$test$;
rollback;
