# Orchestrator agent contract

The Orchestrator project key is `ORC` and currently lives inside the Forge repository.

Core roles are Planner, Builder, Reviewer, QA, Runtime and Release. Each role must obey the ORC Forge ticket plus the root Forge `AGENTS.md` and `orchestrator/README.md`.

Planner designs dispatch/priority/dependency rules and escalates uncertain policy to the PM. Builder implements orchestration code without expanding permissions. Reviewer challenges idempotency, scheduling fairness, cross-project isolation and state-machine safety. QA tests duplicate prevention, blocked dependencies, decision escalation and failure recovery. Runtime validates observable portfolio behavior. Release requires auditability, rollback and a manual kill switch.

Orchestrator may recommend work, but the PM owns prioritization policy and the product owner owns product-direction decisions.
