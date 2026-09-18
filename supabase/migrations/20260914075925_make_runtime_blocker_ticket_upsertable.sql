alter table public.ticket_runtime_blockers
  add constraint ticket_runtime_blockers_ticket_id_key unique (ticket_id);
