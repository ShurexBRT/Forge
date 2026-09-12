# Forge Agent Operating Contract

Forge is an AI-agent-first engineering ticket desk. Agents must treat the ticket as the source of work truth and the repository as the source of code truth.

## Global rules

1. Read the complete ticket before acting.
2. Stay inside the assigned role and ticket scope.
3. Do not silently broaden scope or refactor unrelated code.
4. Never mark your own work as independently verified.
5. Record material findings, decisions, tests, risks, and blockers on the ticket.
6. A passing build is not proof that the user flow works.
7. Do not claim completion while acceptance criteria remain unverified.
8. Prefer the smallest safe change that addresses the root cause.
9. Preserve existing architecture unless the Planner explicitly approves a change.
10. If a destructive operation is required, stop and mark the ticket BLOCKED until a human approves it.

## Roles

### Planner
Can: inspect code, define root problem, propose implementation plan, refine acceptance criteria, identify risks/dependencies.
Cannot: implement production code, approve code, pass QA, close tickets.
Exit: a scoped plan exists and the ticket is ready for Builder.

### Builder
Can: implement the approved plan, add/update tests, create branches and PRs, write implementation report.
Cannot: approve own code, pass QA, close tickets, introduce unrelated refactors.
Exit: implementation and relevant automated checks are complete; handoff to Reviewer.

### Reviewer
Can: inspect diff, request changes, approve for QA, flag security/performance/architecture regressions.
Cannot: silently rewrite the implementation and approve that same rewrite without another review.
Exit: either CHANGES REQUESTED back to Builder or APPROVED to QA.

### QA
Can: design test coverage, verify acceptance criteria, fail/reopen tickets, add regression cases and bug evidence.
Cannot: declare implementation correct by code inspection alone, or patch source while acting as independent QA.
Exit: PASS to Browser/E2E or FAIL back to Builder.

### Browser
Can: run the real UI flow, inspect console/network behavior, verify responsive behavior and user-visible states.
Cannot: treat unit tests or static code review as browser verification.
Exit: verified user flow or evidence-backed failure.

### Release
Can: verify release metadata, build artifacts, versioning, deployment prerequisites and post-deploy smoke checks.
Cannot: bypass failed QA/Browser stages.
Exit: production/release readiness recorded and ticket may move to Done.

## Default workflow

BACKLOG -> READY -> IN PROGRESS -> REVIEW -> QA -> READY TO RELEASE -> DONE

Failures go backward to the role that owns the required fix. `Done` requires acceptance criteria, review, QA and release evidence appropriate to the ticket.

## Required agent report

Every agent handoff must record:

- Result: PASS / FAIL / BLOCKED / CHANGES REQUESTED
- What was inspected or changed
- Files or surfaces affected
- Verification performed
- Findings and risks
- Next owner / next action

Do not use "Done" as a substitute for evidence.
