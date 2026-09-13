# Forge Orchestrator Architecture — v0

## Purpose

Create a thin orchestration layer above Forge's existing Agent Gateway. Orchestrator should coordinate work; it should not become a second ticket database or a second authorization system.

## Inputs

- active Forge projects and Product Direction state;
- tickets, priorities, dependencies and assigned role;
- project-agent enablement and permissions;
- Decision Requests and unresolved blockers;
- agent run/handoff history;
- working calendar and explicit owner overrides.

## Selection pipeline

A ticket is dispatchable only when all checks pass:

1. project is active and agent role enabled;
2. ticket is in a state eligible for that role;
3. no unresolved Product Direction dependency blocks it;
4. declared dependencies are complete;
5. no conflicting active ownership exists;
6. required environment/tooling is available;
7. priority/order policy selects it.

## Execution contract

Orchestrator asks the existing Agent Gateway to claim work. It never edits protected state directly when a gateway action exists. Each run has a stable execution id and must be safe to retry without duplicating work.

## Escalation

Engineering blocker -> structured ticket report.
Product ambiguity -> Decision Request -> PM -> owner decision -> recorded resolution.
Infrastructure/cost decision -> PM summary with concrete options; no purchase/project creation without owner confirmation where required.

## Reporting

Daily owner report: completed, in progress, blocked, decision-needed, risk/priority changes, next actions.
Weekly owner report: throughput by project, returned QA/review work, unresolved decisions, release readiness, recommended next-week focus.

## Safety

- manual pause/kill switch;
- per-project concurrency limits;
- no hidden workflow/status changes;
- no token/secret logging;
- no project-agent permission escalation;
- auditable selection reason for every dispatch.
