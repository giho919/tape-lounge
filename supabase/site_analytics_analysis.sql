-- Add chart analysis to the existing seven-argument, write-only analytics RPC.
-- The older site_analytics.sql is historical bootstrap SQL, not an upgrade path.
-- Apply as one recorded Supabase migration before deploying the browser change.
-- Preserve the current body, owner, ACL, limits and internal-traffic handling.
do $migration$
declare
  v_target regprocedure := to_regprocedure('public.record_site_activity(uuid,uuid,text,integer,boolean,text,boolean)');
  v_source text;
  v_before text := $guard$p_tab not in ('lounge', 'desk', 'chain', 'macro', 'game', 'chars', 'domestic')$guard$;
  v_after text := $guard$p_tab not in ('lounge', 'desk', 'chain', 'macro', 'game', 'chars', 'domestic', 'analysis')$guard$;
begin
  if v_target is null then
    raise exception 'Expected seven-argument analytics RPC is missing';
  end if;
  v_source := pg_get_functiondef(v_target);
  if strpos(v_source, v_after) > 0 then
    return;
  end if;
  if strpos(v_source, v_before) = 0 then
    raise exception 'Analytics validation changed; review the current function before upgrading';
  end if;
  execute replace(v_source, v_before, v_after);
end;
$migration$;
