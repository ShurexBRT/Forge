-- Forge v0.2 Supabase schema
-- Designed for a single authenticated owner per project in v0.2.
-- Multi-user membership is intentionally deferred.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key ~ '^[A-Z][A-Z0-9]{1,9}$'),
  name text not null,
  description text not null default '',
  github_repo text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, key)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  type text not null check (type in ('Bug', 'Feature', 'Task')),
  priority text not null check (priority in ('Urgent', 'High', 'Medium', 'Low')),
  status text not null default 'Backlog' check (status in ('Backlog', 'Ready', 'In Progress', 'Review', 'QA', 'Ready to Release', 'Done')),
  assigned_agent text check (assigned_agent is null or assigned_agent in ('Planner', 'Builder', 'Reviewer', 'QA', 'Browser', 'Release')),
  branch text,
  pull_request text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acceptance_criteria (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'Unknown',
  author_type text not null default 'human' check (author_type in ('human', 'agent', 'system')),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  role text not null check (role in ('Planner', 'Builder', 'Reviewer', 'QA', 'Browser', 'Release')),
  status text not null check (status in ('pending', 'active', 'passed', 'failed')),
  note text,
  report text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_activity (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default 'System',
  actor_type text not null default 'system' check (actor_type in ('human', 'agent', 'system')),
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists tickets_project_id_idx on public.tickets(project_id);
create index if not exists tickets_status_idx on public.tickets(status);
create index if not exists acceptance_criteria_ticket_id_idx on public.acceptance_criteria(ticket_id);
create index if not exists ticket_comments_ticket_id_idx on public.ticket_comments(ticket_id);
create index if not exists agent_runs_ticket_id_idx on public.agent_runs(ticket_id);
create index if not exists ticket_activity_ticket_id_idx on public.ticket_activity(ticket_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.log_ticket_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_activity(ticket_id, actor_id, actor_name, actor_type, action)
    values (new.id, new.created_by, 'Human', 'human', 'Created ticket');
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.ticket_activity(ticket_id, actor_id, actor_name, actor_type, action)
    values (new.id, (select auth.uid()), 'Human', 'human', 'Moved ticket to ' || new.status);
  end if;

  return new;
end;
$$;

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

create trigger ticket_comments_set_updated_at
before update on public.ticket_comments
for each row execute function public.set_updated_at();

create trigger agent_runs_set_updated_at
before update on public.agent_runs
for each row execute function public.set_updated_at();

create trigger tickets_activity_log
before insert or update on public.tickets
for each row execute function public.log_ticket_activity();

alter table public.projects enable row level security;
alter table public.tickets enable row level security;
alter table public.acceptance_criteria enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.agent_runs enable row level security;
alter table public.ticket_activity enable row level security;

revoke all on table public.projects from anon, authenticated;
revoke all on table public.tickets from anon, authenticated;
revoke all on table public.acceptance_criteria from anon, authenticated;
revoke all on table public.ticket_comments from anon, authenticated;
revoke all on table public.agent_runs from anon, authenticated;
revoke all on table public.ticket_activity from anon, authenticated;

grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.tickets to authenticated;
grant select, insert, update, delete on table public.acceptance_criteria to authenticated;
grant select, insert, update, delete on table public.ticket_comments to authenticated;
grant select, insert, update, delete on table public.agent_runs to authenticated;
grant select, insert on table public.ticket_activity to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "projects_select_own"
on public.projects for select
to authenticated
using ((select auth.uid()) = created_by);

create policy "projects_insert_own"
on public.projects for insert
to authenticated
with check ((select auth.uid()) = created_by);

create policy "projects_update_own"
on public.projects for update
to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by);

create policy "projects_delete_own"
on public.projects for delete
to authenticated
using ((select auth.uid()) = created_by);

create policy "tickets_select_owned_project"
on public.tickets for select
to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.created_by = (select auth.uid())
));

create policy "tickets_insert_owned_project"
on public.tickets for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = project_id and p.created_by = (select auth.uid())
  )
);

create policy "tickets_update_owned_project"
on public.tickets for update
to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.created_by = (select auth.uid())
))
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = project_id and p.created_by = (select auth.uid())
  )
);

create policy "tickets_delete_owned_project"
on public.tickets for delete
to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = project_id and p.created_by = (select auth.uid())
));

create policy "criteria_select_owned_project"
on public.acceptance_criteria for select
to authenticated
using (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
));

create policy "criteria_insert_owned_project"
on public.acceptance_criteria for insert
to authenticated
with check (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
));

create policy "criteria_update_owned_project"
on public.acceptance_criteria for update
to authenticated
using (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
))
with check (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
));

create policy "criteria_delete_owned_project"
on public.acceptance_criteria for delete
to authenticated
using (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
));

create policy "comments_select_owned_project"
on public.ticket_comments for select
to authenticated
using (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
));

create policy "comments_insert_owned_project"
on public.ticket_comments for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1
    from public.tickets t
    join public.projects p on p.id = t.project_id
    where t.id = ticket_id and p.created_by = (select auth.uid())
  )
);

create policy "comments_update_own"
on public.ticket_comments for update
to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

create policy "comments_delete_own"
on public.ticket_comments for delete
to authenticated
using (author_id = (select auth.uid()));

create policy "agent_runs_select_owned_project"
on public.agent_runs for select
to authenticated
using (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
));

create policy "agent_runs_insert_owned_project"
on public.agent_runs for insert
to authenticated
with check (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
));

create policy "agent_runs_update_owned_project"
on public.agent_runs for update
to authenticated
using (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
))
with check (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
));

create policy "agent_runs_delete_owned_project"
on public.agent_runs for delete
to authenticated
using (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
));

create policy "activity_select_owned_project"
on public.ticket_activity for select
to authenticated
using (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
));

create policy "activity_insert_owned_project"
on public.ticket_activity for insert
to authenticated
with check (exists (
  select 1
  from public.tickets t
  join public.projects p on p.id = t.project_id
  where t.id = ticket_id and p.created_by = (select auth.uid())
));
