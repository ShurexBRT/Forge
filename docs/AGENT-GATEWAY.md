# Forge Agent Gateway

Forge Agent Gateway is the programmatic work interface used by specialized agents. GitHub remains code truth; Forge remains work truth.

## Endpoint

`POST https://yljhffprkprbgjdaarqi.supabase.co/functions/v1/agent-gateway`

Required header:

```text
x-forge-agent-token: <FORGE_AGENT_TOKEN>
Content-Type: application/json
```

Never write `FORGE_AGENT_TOKEN` to source code, logs, commits, tickets, comments, screenshots, or generated documentation. Store it only in the agent/runtime secret store.

A token is scoped to exactly one Forge project and one agent identity. The gateway also checks that the project-agent assignment is enabled.

## Execution contract

Forge uses explicit ticket dependencies and execution leases. A ticket may have only one non-expired active lease at a time.

Orchestrated execution:

1. Orchestrator selector evaluates Product Direction, Decision Requests, dependencies, role enablement, status, priority and active leases.
2. Dispatcher reserves the selected ticket and returns an `execution_id` plus `lease_until`.
3. The selected agent calls `claim` with that exact `execution_id`.
4. Long-running work sends `heartbeat` before the lease expires.
5. `handoff` or `release_lease` releases ownership.
6. An expired execution no longer owns the ticket and must not continue mutating Forge state.

A direct/manual agent claim is still possible when no active lease exists. In that case the gateway creates the lease and returns its `execution_id`.

## Core loop

1. Ask for the next ticket assigned to your role.
2. Read the returned ticket, acceptance criteria, dependencies, Product Direction, open decisions, comments and previous agent runs.
3. Claim the ticket before performing work.
4. Preserve the returned `execution_id` for heartbeat/handoff.
5. Read repository `AGENTS.md` and `.forge/project.json` before editing.
6. Perform only your role's responsibility.
7. If product intent is unclear, create a Decision Request and return `BLOCKED`; do not guess.
8. Submit a structured handoff. Forge determines the next legal owner/status.

## Get next ticket

```json
{
  "action": "next_ticket"
}
```

Tickets with unresolved dependencies, an open ticket Decision Request, an invalid Product Direction state for the role, or another active lease are not returned as available work.

## Get a specific ticket

```json
{
  "action": "get_ticket",
  "ticket_key": "MAY-42"
}
```

The project key in `ticket_key` must match the project encoded in your credential.

## Claim

For an Orchestrator-dispatched execution:

```json
{
  "action": "claim",
  "ticket_key": "MAY-42",
  "execution_id": "<execution UUID>"
}
```

For a direct/manual claim, omit `execution_id`; the gateway creates a 30-minute lease and returns the generated execution id.

The gateway refuses claims when the ticket is assigned to another role, is in an invalid state, has unresolved dependencies, is blocked by Product Direction/Decision Request, or is already leased.

## Heartbeat

For work that can outlive the current lease:

```json
{
  "action": "heartbeat",
  "execution_id": "<execution UUID>",
  "extend_minutes": 30
}
```

The gateway only extends a live lease owned by the same project-agent identity. Expired leases cannot be revived by heartbeat.

## Product Decision Request

Use this instead of inventing a requirement:

```json
{
  "action": "decision_request",
  "ticket_key": "CHR-4",
  "title": "Choose final product scope",
  "context": "The current slice supports several possible product directions.",
  "question": "Which direction is approved before broad gameplay expansion?",
  "options": [
    "Focused premium puzzle-platformer",
    "Larger action/puzzle campaign",
    "Portfolio-quality vertical slice"
  ]
}
```

After creating the request, submit a `BLOCKED` handoff if that decision blocks the ticket.

## Handoff

Valid results:

- `PASS`
- `FAIL`
- `BLOCKED`
- `CHANGES_REQUESTED`

When the ticket has an execution lease, include its `execution_id`:

```json
{
  "action": "handoff",
  "ticket_key": "MAY-42",
  "execution_id": "<execution UUID>",
  "result": "PASS",
  "note": "Implementation complete and local validation passed.",
  "report": "Changed files: ...\nValidation: ...\nRisks: ...\nNext action: code review."
}
```

The agent does **not** choose an arbitrary next status. Forge applies the legal pipeline transition:

```text
Planner PASS  -> Builder / Ready
Builder PASS  -> Reviewer / Review
Reviewer PASS -> QA / QA
QA PASS       -> Browser / QA
Browser PASS  -> Release / Ready to Release
Release PASS  -> Done
```

Review/QA/runtime failures return to Builder. `BLOCKED` keeps the ticket in place, records the report, and releases the execution lease so a human decision does not pin an agent worker indefinitely.

## Abort / release

If the worker must stop without a normal handoff:

```json
{
  "action": "release_lease",
  "execution_id": "<execution UUID>",
  "reason": "Worker shutdown before implementation started"
}
```

## Required report quality

A handoff must make the next role able to continue without reconstructing the work from Git history:

```text
Result: PASS | FAIL | BLOCKED | CHANGES_REQUESTED
Ticket: <KEY-N>
Role: <role>
Execution: <execution_id>
Inspected/changed:
- ...
Validation:
- ...
Product-direction dependency:
- none | Decision Request <topic>
Findings/risks:
- ...
Next owner/action:
- ...
```

"Done", "looks good", or code compilation alone is not sufficient evidence.
