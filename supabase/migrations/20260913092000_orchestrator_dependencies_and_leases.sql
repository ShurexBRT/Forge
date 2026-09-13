create table if not exists public.ticket_dependencies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  depends_on_ticket_id uuid not null references public.tickets(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ticket_dependencies_not_self check (ticket_id <> depends_on_ticket_id),
  constraint ticket_dependencies_unique unique (ticket_id, depends_on_ticket_id)
);

create index if not exists ticket_dependencies_ticket_idx on public.ticket_dependencies(ticket_id);
create index if not exists ticket_dependencies_depends_on_idx on public.ticket_dependencies(depends_on_ticket_id);

create or replace function private.prevent_ticket_dependency_cycle()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  creates_cycle boolean;
begin
  with recursive reachable(ticket_id) as (
    select new.depends_on_ticket_id
    union
    select td.depends_on_ticket_id
    from public.ticket_dependencies td
    join reachable r on td.ticket_id = r.ticket_id
  )
  select exists(select 1 from reachable where ticket_id = new.ticket_id)
  into creates_cycle;

  if creates_cycle then
    raise exception 'Ticket dependency would create a cycle';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_ticket_dependency_cycle() from public;

drop trigger if exists ticket_dependencies_prevent_cycle on public.ticket_dependencies;
create trigger ticket_dependencies_prevent_cycle
before insert or update of ticket_id, depends_on_ticket_id
on public.ticket_dependencies
for each row execute function private.prevent_ticket_dependency_cycle();

alter table public.ticket_dependencies enable row level security;

drop policy if exists ticket_dependencies_select_accessible on public.ticket_dependencies;
create policy ticket_dependencies_select_accessible
on public.ticket_dependencies
for select
to authenticated
using (
  private.can_access_project((select t.project_id from public.tickets t where t.id = ticket_id))
);

drop policy if exists ticket_dependencies_admin_write on public.ticket_dependencies;
create policy ticket_dependencies_admin_write
on public.ticket_dependencies
for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

create table if not exists public.orchestrator_leases (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  agent_role text not null,
  execution_id uuid not null default gen_random_uuid(),
  status text not null default 'active' check (status in ('active','released','expired','cancelled')),
  acquired_at timestamptz not null default now(),
  lease_until timestamptz not null,
  heartbeat_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text,
  metadata jsonb not null default '{}'::jsonb,
  constraint orchestrator_leases_execution_unique unique (execution_id)
);

create unique index if not exists orchestrator_one_active_lease_per_ticket
  on public.orchestrator_leases(ticket_id)
  where status = 'active';
create index if not exists orchestrator_leases_active_expiry_idx
  on public.orchestrator_leases(lease_until)
  where status = 'active';
create index if not exists orchestrator_leases_agent_idx
  on public.orchestrator_leases(agent_id);

alter table public.orchestrator_leases enable row level security;

drop policy if exists orchestrator_leases_admin_select on public.orchestrator_leases;
create policy orchestrator_leases_admin_select
on public.orchestrator_leases
for select
to authenticated
using ((select private.current_user_is_admin()));

drop policy if exists orchestrator_leases_admin_write on public.orchestrator_leases;
create policy orchestrator_leases_admin_write
on public.orchestrator_leases
for all
to authenticated
using ((select private.current_user_is_admin()))
with check ((select private.current_user_is_admin()));

comment on table public.ticket_dependencies is 'Explicit ticket-to-ticket dependency graph used by Forge Orchestrator.';
comment on table public.orchestrator_leases is 'Auditable execution leases preventing parallel ownership of the same ticket.';
