# Orchestrator Project Context

- ChatGPT Project: Orchestrator
- Forge key: ORC
- Repository: ShurexBRT/Forge (`orchestrator/` + Supabase Edge Functions)
- Code truth: GitHub repository
- Work truth: Forge tickets
- Knowledge/product context: ChatGPT Project `Orchestrator`
- Product direction: Defined
- Escalation: Specialized agent -> Orchestrator -> PM -> Owner

## Purpose
Orchestrator is the portfolio control plane above project agents. It selects eligible work, enforces Product Direction gates and dependencies, reserves execution leases, dispatches role-specific work, recovers abandoned executions, aggregates PM reports and routes meaningful notifications.

## Hard boundaries
- Orchestrator must never invent product direction.
- It must never bypass Forge status rules, dependencies, leases or agent permissions.
- It must not perform broad code changes simply because work is available.
- It must preserve GitHub as code truth and Forge as work truth.
- Owner/PM decisions override autonomous scheduling.

## Operating cadence
Normal autonomous cadence is Monday-Friday beginning at 08:00 Europe/Belgrade. Weekend work requires an explicit owner override. The current first-working-day exception is an owner override, not a permanent weekend rule.

## PM relationship
Project agents report structured evidence to Forge. Orchestrator aggregates it. PM decides what requires owner attention. Owner receives concise daily/weekly portfolio reporting and explicit decision requests, not raw agent chatter.
