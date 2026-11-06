-- Private daily-funnel report: distinct qualified browsers, not confirmed people.
-- Per-browser event rows are removed after 14 days; this query reads retained totals.
with daily as (
  select
    event_day,
    round_version,
    max(unique_browsers) filter (where event_type = 'start') as starts,
    max(unique_browsers) filter (where event_type = 'complete') as full_completions
  from private.site_blind_daily_event_counts
  where event_day >= (now() at time zone 'Asia/Seoul')::date - 30
  group by event_day, round_version
)
select
  event_day,
  round_version,
  coalesce(starts, 0) as started_browsers,
  coalesce(full_completions, 0) as completed_browsers,
  round(100.0 * coalesce(full_completions, 0) / nullif(starts, 0), 1) as completion_percent
from daily
order by event_day desc, round_version;
