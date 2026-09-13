# Orchestrator

Orchestrator is the portfolio-level control plane above Forge projects.

It does **not** replace Forge as work truth and does **not** replace GitHub as code truth. Its job is to select eligible work, dispatch the correct project-specialized agent, collect evidence-based handoffs, detect blockers/dependencies, escalate product decisions to the PM, and prepare concise PM summaries.

## Initial operating model

```text
Portfolio backlog
  -> eligibility + priority check
  -> Product Direction gate
  -> dependency check
  -> dispatch Planner/Builder/Reviewer/QA/Runtime/Release
  -> collect structured handoff
  -> update only allowed Forge state
  -> escalate blockers/decisions to PM
  -> PM reports to owner
```

## Hard rules

- Never invent product direction.
- Never bypass a repository's `AGENTS.md`, release checklist, RLS/security boundary or native/runtime gate.
- Never let Builder self-review or self-pass QA.
- Never mark a ticket Done because code compiled.
- Never silently change ticket workflow semantics.
- Never work a blocked dependency as if it were ready.
- Every dispatch and handoff must be auditable.
- Prefer one clearly owned ticket per agent execution over broad multi-ticket edits.

## Work cadence

Normal portfolio cadence is Monday-Friday from 08:00 Europe/Belgrade. Saturday/Sunday are no-dispatch by default. Sunday 2026-09-13 is an explicit first-day exception approved by the owner.

The scheduling rule controls automatic dispatch, not emergency owner-requested work.

## Dry-run selector

The first live Orchestrator component is `orchestrator-dry-run`, deployed as a Forge Supabase Edge Function and committed under `supabase/functions/orchestrator-dry-run/`.

It can rank eligible work and explain blockers, but it cannot claim or mutate a ticket. The ranking contract is documented in `orchestrator/SELECTION-POLICY.md`.

Explicit ticket dependencies are not modeled yet, so autonomous dispatch remains disabled until dependency metadata and cycle-safe blocking are implemented.

## First milestone

Before autonomous dispatch is enabled, Orchestrator must prove:

1. deterministic eligible-ticket selection;
2. project/role permission enforcement;
3. dependency and Product Direction blocking;
4. idempotent claim/retry behavior;
5. structured agent handoff ingestion;
6. failed-agent recovery without duplicate work;
7. portfolio daily/weekly PM reporting;
8. complete auditability and manual kill switch.
