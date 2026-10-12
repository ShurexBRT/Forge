# Orchestrator selection policy v0

This policy is intentionally dry-run only. It ranks work but cannot claim or mutate tickets.

## Order

1. Prefer finishing active workflow stages over opening new Ready work.
2. Within the same stage, use priority: Urgent > High > Medium > Low.
3. For ties, prefer the older update timestamp and then the lower ticket number.

Stage order:

`Ready to Release > QA > Review > In Progress > Ready`

## Eligibility

A candidate must have an enabled project agent for the required role and no open Decision Request linked directly to the ticket.

For projects whose Product Direction is not `defined`, non-Planner execution is blocked. Planner may inspect the ticket only to determine whether the work is safely scoped or must become a Decision Request.

## Current limitation

Forge now models explicit ticket dependencies with cycle detection. The selector blocks unresolved dependencies, live leases and active runtime blockers. The local runner remains read-only while authenticated runtime behavior and recovery are verified. See `docs/ORCHESTRATOR-RUNNER-PLAN.md` for the remaining execution gates.

## Non-goal

The dry-run endpoint never claims tickets, changes workflow state, issues credentials, or bypasses the Agent Gateway.
