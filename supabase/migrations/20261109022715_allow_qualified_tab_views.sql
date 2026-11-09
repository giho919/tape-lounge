-- Preserve the five-second qualification for new external sessions while
-- allowing zero-second tab-view events for an already-qualified session.
DO $migration$
DECLARE
  v_target regprocedure := to_regprocedure(
    'public.record_site_activity(uuid,uuid,text,integer,boolean,text,boolean)'
  );
  v_source text;
  v_before constant text := 'v_active < 5';
  v_after constant text :=
    'v_active < 5 and not (coalesce(p_is_view, false) and v_active = 0 and v_session_exists)';
  v_hits integer;
BEGIN
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Expected public.record_site_activity signature was not found';
  END IF;

  v_source := pg_get_functiondef(v_target);

  IF strpos(v_source, v_after) > 0 THEN
    RETURN;
  END IF;

  v_hits := (length(v_source) - length(replace(v_source, v_before, ''))) / length(v_before);
  IF v_hits <> 1 OR strpos(v_source, 'v_session_exists boolean') = 0 THEN
    RAISE EXCEPTION 'record_site_activity definition does not match the expected safe patch';
  END IF;

  EXECUTE replace(v_source, v_before, v_after);
END;
$migration$;

NOTIFY pgrst, 'reload schema';
