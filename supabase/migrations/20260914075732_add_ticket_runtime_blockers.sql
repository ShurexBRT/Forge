create table public.ticket_runtime_blockers (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  source_agent_id uuid references public.agents(id) on delete set null,
  source_role text not null,
  source_execution_id uuid,
  reason text not null default '',
  status text not null default 'active' check (status in ('active', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_actor text,
  resolution_note text not null default ''
);

alter table public.ticket_runtime_blockers enable row level security;

create policy ticket_runtime_blockers_admin_all
on public.ticket_runtime_blockers
for all
to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());
