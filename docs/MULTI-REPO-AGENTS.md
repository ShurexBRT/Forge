# Forge Multi-Repo Agent Standard

Forge is the work-truth layer for AI-assisted development across the owner's active repositories. GitHub remains code truth.

## Required repository files

Every active repository should contain:

- `AGENTS.md` — repository-specific product truth, technical boundaries, validation gates and role rules.
- `.forge/project.json` — stable Forge project identity and workflow metadata.

## Standard roles

1. **Planner** — inspects the ticket and repository, narrows scope, identifies risks and proposes the implementation plan. Does not implement production code.
2. **Builder** — implements the approved scope and relevant automated checks. Cannot approve its own work.
3. **Reviewer** — reviews the diff for correctness, regression, architecture, security and scope creep. Returns changes or approves for QA.
4. **QA** — validates acceptance criteria, negative cases and regression scope independently of Builder.
5. **Browser / Runtime** — validates the actual user/runtime behavior. The exact runtime depends on the repository: browser/PWA, game runtime, or native desktop.
6. **Release** — validates build/deploy/version/release gates and records final evidence.

## Product Direction Gate

Agents are executors and specialists, not substitute product owners.

Before planning broad product, UX, gameplay, visual-direction or scope-changing work, the Planner must read the project's `project_direction` state in Forge.

- `defined` — work may proceed inside the documented product brief and ticket scope.
- `needs_alignment` — agents may inspect, audit and fix clearly scoped defects, but must not invent broad product direction.
- `blocked_on_owner` — any work that depends on the unresolved decision must stop.

When product intent is unclear, the agent must create or request a Forge `decision_request` containing:

1. the concrete question blocking responsible work;
2. relevant current-state context;
3. two or more viable options when possible;
4. trade-offs and a recommended option when evidence supports one;
5. the ticket or area affected.

The escalation chain is:

```text
Specialist agent -> PM / Orchestrator -> Product Owner -> PM decision record -> Specialist agent
```

The specialist agent must not silently choose an option just because it is technically convenient. The PM summarizes the issue for the owner, records the owner's decision in Forge, updates product direction when needed, and only then returns the work to the execution pipeline.

## Work-truth protocol

When Forge Cloud is configured, a task must begin from a Forge ticket key such as `MAY-142` or `AMP-37`.

Agent procedure:

1. Load the Forge ticket and acceptance criteria.
2. Read the repository's `AGENTS.md` and `.forge/project.json`.
3. Read the project's product-direction state when the task has product/UX/gameplay implications.
4. Verify the ticket is in a state the current role may act on.
5. Inspect current code before editing.
6. Work only inside the ticket scope.
7. Run the repository-specific validation gates.
8. Write a structured handoff/report to the ticket.
9. Move the ticket only through an allowed transition.

## Shared hard rules

- Never let Builder self-approve or self-pass QA.
- Never call a task done because code compiled.
- Never perform unrelated refactors in a scoped ticket.
- Never expose secrets or service-role credentials in client code.
- Never bypass security or CI gates to make a task green.
- Never overwrite unfamiliar work without first understanding it.
- Never invent product direction to unblock yourself.
- Prefer minimal root-cause fixes over broad rewrites.
- Product-specific `AGENTS.md` constraints override generic agent preference.

## Required handoff report

Every role handoff should record:

```text
Result: PASS | FAIL | BLOCKED | CHANGES REQUESTED
Ticket: <KEY-NUMBER>
Role: <Planner|Builder|Reviewer|QA|Browser|Release>
Inspected/changed:
- ...
Validation:
- ...
Product-direction dependency:
- none | decision request <id/topic>
Findings/risks:
- ...
Next owner/action:
- ...
```

## Initial onboarded projects

- FOR — Forge
- MAY — Maylo
- AMP — AMP99
- CHR — Chrono Crawler
- HOF — Heart of Forest
- SMP — Smart Meal Planner v2

Old experiments and dormant repositories are intentionally excluded until they become active again.
