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

Forge does not yet model explicit ticket-to-ticket dependencies. The dry-run selector therefore reports that dependency enforcement is unavailable rather than pretending to enforce it. Adding dependency metadata and cycle-safe blocking is the next gate before autonomous dispatch.

## Non-goal

The dry-run endpoint never claims tickets, changes workflow state, issues credentials, or bypasses the Agent Gateway.
