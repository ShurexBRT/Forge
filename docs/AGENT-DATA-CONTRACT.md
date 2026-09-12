# Forge Agent Data Contract

Forge treats tickets as work state, GitHub as code state, and agent runs as execution evidence.

This document defines how automated agents are expected to read and write Forge data. It is intentionally stricter than the database schema: database access is capability, this contract is policy.

## Source-of-truth boundaries

- `projects` — project identity and linked repository context.
- `tickets` — current work state and ownership of the task.
- `acceptance_criteria` — externally verifiable conditions for completion.
- `ticket_comments` — human/agent discussion and handoff notes.
- `agent_runs` — structured execution history per specialist role.
- `ticket_activity` — append-only audit trail of important state changes.
- GitHub branch/PR/commit — source-code truth. Never copy code into Forge as a substitute for a linked Git object.

## Ticket workflow

Canonical ticket statuses:

`Backlog -> Ready -> In Progress -> Review -> QA -> Ready to Release -> Done`

Backward transitions are expected when verification fails.

### Role-owned transitions

| Role | May enter | Normal exit | Failure exit |
| --- | --- | --- | --- |
| Planner | Ready | In Progress / Builder handoff | Backlog / Blocked note |
| Builder | In Progress | Review | In Progress with blocker note |
| Reviewer | Review | QA | In Progress |
| QA | QA | Ready to Release or Browser verification handoff | In Progress |
| Browser | QA | Ready to Release | In Progress |
| Release | Ready to Release | Done | QA / In Progress depending on cause |

A role must not mark a stage it did not perform as `passed`.

## Agent run lifecycle

Each role is projected in the UI from the latest `agent_runs` record for that role.

Statuses:

- `pending` — no work started.
- `active` — agent has accepted the task and is working.
- `passed` — role-specific verification or work completed successfully.
- `failed` — role found a blocking failure or its own execution failed.

A new attempt may either update the current pending/active row or create a new row. Historical attempts must not be deleted simply to make the ticket look green.

## Required report format

Every completed agent run should populate `report` with:

```text
Result: PASS | FAIL | BLOCKED | CHANGES REQUESTED

Inspected / changed:
- ...

Verification:
- ...

Findings / risks:
- ...

Next owner:
- Planner | Builder | Reviewer | QA | Browser | Release | Human
```

`note` is a short UI summary. `report` is the evidence-bearing record.

## Agent responsibilities

### Planner

Can read all project/ticket context and write planning notes, acceptance criteria, and a Planner run.

Must not modify production source code while acting as Planner or pass downstream roles.

### Builder

Can link branch/PR information, write implementation notes, and update the Builder run.

Must not pass Reviewer, QA, Browser, or Release stages.

### Reviewer

Can record review findings and move a ticket forward to QA or backward to development.

Must not silently implement its own requested changes and then self-approve them.

### QA

Can add verification comments, update QA run state, and reopen development.

Must not treat a build or code inspection as functional verification.

### Browser

Can record real UI/E2E verification, console/network evidence, and Browser run state.

Must not claim browser verification without exercising the actual rendered app.

### Release

Can record build/deployment evidence and Release run state.

Must not move a ticket to Done when required prior stages or acceptance criteria are unresolved.

## Comment semantics

`author_type` values:

- `human` — user/operator comment.
- `agent` — agent-generated handoff, finding, or discussion.
- `system` — automated platform event not authored by a specialist agent.

Agents should prefer structured `agent_runs.report` for execution evidence and use comments for conversation, questions, or concise handoffs.

## Activity semantics

`ticket_activity` is audit-oriented. Do not edit or delete activity records as part of normal work.

Material events that belong in activity include:

- ticket created
- status changed
- agent assignment changed
- PR linked/unlinked
- major verification outcome
- release/deployment result

## Security boundary

The browser application uses a Supabase publishable key plus an authenticated user session. RLS restricts browser-visible data to projects owned by that user in v0.2.

Never expose a Supabase `service_role`/secret key in:

- GitHub Pages
- `VITE_*` variables
- frontend code
- ticket comments
- agent reports
- repository files

Privileged automation should use a server-side/connector/MCP credential path, never a browser credential workaround.

## Definition of Done

A ticket may be `Done` only when the evidence appropriate to its scope exists. At minimum for implementation work:

1. implementation is linked to source-control evidence,
2. review is complete,
3. acceptance criteria are verified,
4. QA has passed,
5. browser/E2E verification exists when user-facing behavior changed,
6. release readiness or deployment evidence exists when applicable,
7. unresolved critical findings are absent.

The string `Done` is state, not proof.
