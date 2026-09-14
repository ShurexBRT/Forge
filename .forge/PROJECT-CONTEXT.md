# Forge Project Context

- ChatGPT Project: Forge
- Forge key: FOR
- Repository: ShurexBRT/Forge
- Code truth: GitHub repository
- Work truth: Forge tickets
- Knowledge/product context: ChatGPT Project `Forge`
- Product direction: Defined
- Escalation: Agent -> Orchestrator -> PM -> Owner

## Purpose
Forge is the shared work-control layer for all active projects. It owns tickets, agent handoffs, permissions, dependencies, leases, decision requests and portfolio reporting.

## Execution rule
Agents work only from Forge tickets and must read `AGENTS.md`, `.forge/project.json`, `.forge/agents/<role>.md` and this file before acting.

## Product decision rule
Do not invent new workflow semantics, lifecycle states or governance behavior without an explicit ticket or owner/PM decision.

## PM relationship
Agents report into Forge/Orchestrator. The PM aggregates agent output before escalating to the owner.
