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

## Core loop

1. Ask for the next ticket assigned to your role.
2. Read the returned ticket, acceptance criteria, project direction, open decisions, comments and previous agent runs.
3. Claim the ticket before performing work.
4. Read repository `AGENTS.md` and `.forge/project.json` before editing.
5. Perform only your role's responsibility.
6. If product intent is unclear, create a decision request and return `BLOCKED`; do not guess.
7. Submit a structured handoff. Forge determines the next legal owner/status.

## Get next ticket

```json
{
  "action": "next_ticket"
}
```

## Get a specific ticket

```json
{
  "action": "get_ticket",
  "ticket_key": "MAY-42"
}
```

The project key in `ticket_key` must match the project encoded in your credential.

## Claim

```json
{
  "action": "claim",
  "ticket_key": "MAY-42"
}
```

The gateway refuses claims when the ticket is assigned to another role or is in an invalid state.

## Product decision request

Use this instead of inventing a requirement:

```json
{
  "action": "decision_request",
  "ticket_key": "HOF-5",
  "title": "Choose final progression model",
  "context": "The current vertical slice contains both talent progression and farming progression, but the final product hierarchy is not defined.",
  "question": "Which progression loop should be primary for the first release?",
  "options": [
    "Combat/quest progression primary; farming supportive",
    "Farming/home progression primary; combat supportive",
    "Equal hybrid with explicit scope limits"
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

Example:

```json
{
  "action": "handoff",
  "ticket_key": "MAY-42",
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

Review/QA/runtime failures return to Builder. `BLOCKED` keeps the ticket in place and records the report.

## Required report quality

A handoff must make the next role able to continue without reconstructing your reasoning from Git history:

```text
Result: PASS | FAIL | BLOCKED | CHANGES_REQUESTED
Ticket: <KEY-N>
Role: <role>
Inspected/changed:
- ...
Validation:
- ...
Product-direction dependency:
- none | decision request <topic>
Findings/risks:
- ...
Next owner/action:
- ...
```

"Done", "looks good", or code compilation alone is not sufficient evidence.
