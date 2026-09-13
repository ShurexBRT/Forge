create index if not exists agent_credentials_agent_id_idx on public.agent_credentials(agent_id);
create index if not exists agent_credentials_created_by_idx on public.agent_credentials(created_by);
create index if not exists decision_requests_requested_by_agent_id_idx on public.decision_requests(requested_by_agent_id);
create index if not exists ticket_dependencies_created_by_idx on public.ticket_dependencies(created_by);

drop policy if exists ticket_dependencies_admin_write on public.ticket_dependencies;
create policy ticket_dependencies_admin_insert
on public.ticket_dependencies
for insert
to authenticated
with check ((select private.current_user_is_admin()));
create policy ticket_dependencies_admin_update
on public.ticket_dependencies
for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
create policy ticket_dependencies_admin_delete
on public.ticket_dependencies
for delete
to authenticated
using ((select private.current_user_is_admin()));

drop policy if exists orchestrator_leases_admin_write on public.orchestrator_leases;
create policy orchestrator_leases_admin_insert
on public.orchestrator_leases
for insert
to authenticated
with check ((select private.current_user_is_admin()));
create policy orchestrator_leases_admin_update
on public.orchestrator_leases
for update
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));
create policy orchestrator_leases_admin_delete
on public.orchestrator_leases
for delete
to authenticated
using ((select private.current_user_is_admin()));
