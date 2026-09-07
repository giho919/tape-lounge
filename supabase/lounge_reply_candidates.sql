create or replace function private.lounge_reply_candidates(p_now timestamptz default now())
returns table(source_chat_id bigint, user_id uuid, nick text, first_at timestamptz,
              latest_at timestamptz, messages jsonb)
language sql stable security invoker set search_path = ''
as $$
with pending as (
  select c.id,c.user_id,c.nick,c.body,c.created_at
  from public.salon_chat c
  where c.author_type='human' and c.user_id is not null
    and c.created_at >= p_now - interval '90 minutes' and c.created_at <= p_now
    and not exists (
      select 1 from private.scheduled_chat_replies r
      join public.salon_chat src on src.id=r.source_chat_id
      where src.user_id=c.user_id and r.created_at <= p_now
        and (src.created_at,src.id) >= (c.created_at,c.id)
    )
), gaps as (
  select *, case when created_at - lag(created_at) over(partition by user_id order by created_at,id)
                    <= interval '10 minutes' then 0 else 1 end as boundary
  from pending
), grouped as (
  select *, sum(boundary) over(partition by user_id order by created_at,id) as cluster
  from gaps
), bundles as (
  select (array_agg(id order by created_at desc,id desc))[1] as source_chat_id,
         user_id,(array_agg(nick order by created_at desc,id desc))[1] as nick,
         min(created_at) as first_at,max(created_at) as latest_at,
         jsonb_agg(jsonb_build_object('id',id,'created_at',created_at,'body',body)
                   order by created_at,id) as messages
  from grouped group by user_id,cluster
)
select b.source_chat_id,b.user_id,b.nick,b.first_at,b.latest_at,b.messages
from bundles b
where b.latest_at <= p_now - interval '2 minutes'
  and not exists (
    select 1 from private.scheduled_chat_replies r
    where r.created_at > p_now - interval '10 minutes' and r.created_at <= p_now
  )
  and not exists (
    select 1 from private.scheduled_chat_replies r
    join public.salon_chat src on src.id=r.source_chat_id
    where src.user_id=b.user_id and r.created_at > p_now - interval '30 minutes'
      and r.created_at <= p_now
  )
order by b.first_at,b.source_chat_id;
$$;
revoke all on function private.lounge_reply_candidates(timestamptz) from public,anon,authenticated;
grant execute on function private.lounge_reply_candidates(timestamptz) to service_role;
comment on function private.lounge_reply_candidates(timestamptz) is
'Shared read-only queue for market/reply automations. All eligible bundles, oldest first; semantic filtering happens before selecting one.';

do $patch$
declare def text;
begin
  select pg_get_functiondef('private.publish_scheduled_lounge_reply(bigint,text,text)'::regprocedure) into def;
  if position('lounge_reply_candidates' in def)=0 then
    def := replace(def, '  v_nick := case p_agent_key',
      E'  if not exists (select 1 from private.lounge_reply_candidates() c where c.source_chat_id=p_source_chat_id) then\n    return pg_catalog.jsonb_build_object(''status'',''skipped_ineligible_source'');\n  end if;\n\n  v_nick := case p_agent_key');
    execute def;
  end if;
end;
$patch$;
