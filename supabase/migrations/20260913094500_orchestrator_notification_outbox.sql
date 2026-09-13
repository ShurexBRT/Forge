create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  project_id uuid references public.projects(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete cascade,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  title text not null,
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sent','failed','discarded')),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  dedupe_key text unique
);

create index if not exists notification_outbox_pending_idx on public.notification_outbox(created_at) where status='pending';
create index if not exists notification_outbox_project_idx on public.notification_outbox(project_id);
create index if not exists notification_outbox_ticket_idx on public.notification_outbox(ticket_id);

alter table public.notification_outbox enable row level security;

create policy notification_outbox_admin_select on public.notification_outbox for select to authenticated using ((select private.current_user_is_admin()));
create policy notification_outbox_admin_insert on public.notification_outbox for insert to authenticated with check ((select private.current_user_is_admin()));
create policy notification_outbox_admin_update on public.notification_outbox for update to authenticated using ((select private.current_user_is_admin())) with check ((select private.current_user_is_admin()));
create policy notification_outbox_admin_delete on public.notification_outbox for delete to authenticated using ((select private.current_user_is_admin()));

create or replace function private.enqueue_decision_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.notification_outbox(event_type,project_id,ticket_id,severity,title,body,payload,dedupe_key)
  values ('decision_required',new.project_id,new.ticket_id,'warning','Decision required: ' || new.title,new.question,jsonb_build_object('decision_request_id',new.id,'options',new.options),'decision:' || new.id::text)
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;
revoke all on function private.enqueue_decision_notification() from public;
drop trigger if exists decision_request_notification on public.decision_requests;
create trigger decision_request_notification after insert on public.decision_requests for each row execute function private.enqueue_decision_notification();

create or replace function private.enqueue_ticket_done_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare pkey text;
begin
  if old.status is distinct from new.status and new.status='Done' then
    select key into pkey from public.projects where id=new.project_id;
    insert into public.notification_outbox(event_type,project_id,ticket_id,severity,title,body,payload,dedupe_key)
    values ('ticket_completed',new.project_id,new.id,'info',pkey || '-' || new.ticket_number || ' completed',new.title,jsonb_build_object('ticket_number',new.ticket_number,'project_key',pkey),'ticket_done:' || new.id::text)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.enqueue_ticket_done_notification() from public;
drop trigger if exists ticket_done_notification on public.tickets;
create trigger ticket_done_notification after update of status on public.tickets for each row execute function private.enqueue_ticket_done_notification();

create or replace function private.enqueue_agent_failure_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare project_id_value uuid; pkey text; tnum bigint; ttitle text;
begin
  if old.status is distinct from new.status and new.status='failed' then
    select t.project_id,p.key,t.ticket_number,t.title into project_id_value,pkey,tnum,ttitle from public.tickets t join public.projects p on p.id=t.project_id where t.id=new.ticket_id;
    insert into public.notification_outbox(event_type,project_id,ticket_id,severity,title,body,payload,dedupe_key)
    values ('agent_stage_failed',project_id_value,new.ticket_id,'warning',pkey || '-' || tnum || ' ' || new.role || ' failed',coalesce(new.report,new.note,ttitle),jsonb_build_object('role',new.role,'agent_id',new.agent_id),'agent_fail:' || new.id::text || ':' || coalesce(new.completed_at::text,new.updated_at::text))
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.enqueue_agent_failure_notification() from public;
drop trigger if exists agent_failure_notification on public.agent_runs;
create trigger agent_failure_notification after update of status on public.agent_runs for each row execute function private.enqueue_agent_failure_notification();
