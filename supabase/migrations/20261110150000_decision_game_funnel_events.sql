-- Keep only daily unique-browser counts for starts and full completions.
-- Per-browser hashes are retained for 14 days, then deleted by cron.
create table private.site_decision_event_visitors (
  event_day date not null,
  event_type text not null check (event_type in ('start', 'complete')),
  visitor_hash bytea not null check (octet_length(visitor_hash) = 32),
  created_at timestamptz not null default clock_timestamp(),
  primary key (event_day, event_type, visitor_hash)
);

create index site_decision_event_visitors_created_at_idx
  on private.site_decision_event_visitors (created_at);

create table private.site_decision_event_counts (
  event_day date not null,
  event_type text not null check (event_type in ('start', 'complete')),
  unique_browsers integer not null default 0 check (unique_browsers >= 0),
  updated_at timestamptz not null default now(),
  primary key (event_day, event_type)
);

alter table private.site_decision_event_visitors enable row level security;
alter table private.site_decision_event_counts enable row level security;
revoke all on table private.site_decision_event_visitors from public, anon, authenticated;
revoke all on table private.site_decision_event_counts from public, anon, authenticated;

create function public.record_decision_game_event(
  p_visitor_id uuid,
  p_event_type text,
  p_internal boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_today date := (v_now at time zone 'Asia/Seoul')::date;
  v_visitor_hash bytea;
  v_user_agent text := lower(coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'user-agent', ''
  ));
  v_inserted integer := 0;
begin
  if p_visitor_id is null
    or p_event_type is null or p_event_type not in ('start', 'complete')
    or coalesce(p_internal, false)
  then
    return;
  end if;

  if v_user_agent ~ '(googlebot|google-inspectiontool|googleother|google-agent|storebot-google|bingbot|duckduckbot|baiduspider|yandexbot|applebot|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|redditbot|pinterestbot|ahrefsbot|semrushbot|mj12bot|bytespider|gptbot|claudebot|perplexitybot|crawler|spider|headlesschrome|phantomjs|lighthouse|pagespeed)' then
    return;
  end if;

  v_visitor_hash := extensions.digest(p_visitor_id::text, 'sha256');

  -- Only count a browser whose non-internal site session was seen recently.
  if not exists (
    select 1
    from private.site_visitors v
    where v.visitor_hash = v_visitor_hash
      and not v.is_internal
      and v.last_seen_at >= v_now - interval '30 minutes'
  ) or not exists (
    select 1
    from private.site_visit_sessions s
    where s.visitor_hash = v_visitor_hash
      and not s.is_internal
      and s.page_key = 'decision'
      and s.last_seen_at >= v_now - interval '30 minutes'
  ) then
    return;
  end if;

  -- A completion counts only after the same browser started the game today.
  if p_event_type = 'complete' and not exists (
    select 1
    from private.site_decision_event_visitors e
    where e.event_day = v_today
      and e.event_type = 'start'
      and e.visitor_hash = v_visitor_hash
  ) then
    return;
  end if;

  insert into private.site_decision_event_visitors (
    event_day, event_type, visitor_hash
  ) values (
    v_today, p_event_type, v_visitor_hash
  ) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return;
  end if;

  insert into private.site_decision_event_counts (
    event_day, event_type, unique_browsers, updated_at
  ) values (
    v_today, p_event_type, 1, v_now
  ) on conflict (event_day, event_type) do update
    set unique_browsers = private.site_decision_event_counts.unique_browsers + 1,
        updated_at = excluded.updated_at;
end;
$function$;

revoke all on function public.record_decision_game_event(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.record_decision_game_event(uuid, text, boolean)
  to anon, authenticated;

do $retention$
begin
  if not exists (
    select 1 from cron.job where jobname = 'site-decision-event-retention'
  ) then
    perform cron.schedule(
      'site-decision-event-retention',
      '35 15 * * *',
      'delete from private.site_decision_event_visitors where created_at < now() - interval ''14 days'';'
    );
  end if;
end;
$retention$;
