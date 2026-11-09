-- The paper-trade Edge Function reads position state and saves the nickname
-- through its service-role client. Grant only the columns those calls use.
grant select (user_id, checked_ms, pos)
  on table public.paper_accounts to service_role;

grant update (nick)
  on table public.paper_accounts to service_role;
