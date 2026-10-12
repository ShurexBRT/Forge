# Local runner: proposed first implementation

Prepared 2026-10-12 from repository commit `3c8855a`. This is a source review and implementation proposal, not verification of deployed functions or live database state.

## Existing foundation

- React/TypeScript/Vite frontend deployed through GitHub Pages.
- `supabase/functions/orchestrator-dry-run/index.ts` ranks tickets, checks direction, decisions, enabled roles, dependencies, runtime blockers and leases.
- `supabase/functions/orchestrator-dispatch/index.ts` reserves a lease and returns an execution ID. It does not start an agent process.
- `supabase/functions/agent-gateway/index.ts` implements claim, heartbeat, handoff, unblock and lease release with project/agent credentials.
- Migrations define dependencies, cycle detection, unique active ticket leases, runtime blockers and a notification outbox.
- Repository contracts require distinct role responsibilities and evidence before completion.

`orchestrator/README.md` and `orchestrator/SELECTION-POLICY.md` still describe dependencies as absent. Reconcile these documents with code and deployed state before enabling automation.

## Proposed scope

Keep the runner in this repository under `orchestrator/runner/`. Use TypeScript and a Node runtime. Start with one explicitly configured project, one active execution and one manually initiated Builder ticket. Preserve the existing role pipeline; the first slice ends at Review with a PR and evidence. Review, QA, Browser and Release are subsequent executions, not statuses the Builder awards itself.

The worker needs an adapter for an installed agent CLI. Choose and verify the CLI's actual noninteractive interface, authentication, structured output and cancellation behavior before implementing that adapter. Do not assume that desktop chat controls are a general unattended execution API.

## Execution path

1. Validate local configuration: allowlisted repository path/remote, worker adapter, credentials, checks, timeout and pause state.
2. Show a read-only selection preview. Refuse unexpected project or unsupported role.
3. Reserve through dispatch, then claim through Agent Gateway with the exact execution ID and matching project/role credential.
4. Persist a local execution journal and create an isolated `codex/` branch and worktree from an explicitly configured base.
5. Supply the complete ticket, criteria and repository instructions to the agent. Keep gateway credentials under runner control and out of the agent prompt and logs.
6. Heartbeat independently of the agent process. Stop the process on confirmed ownership loss; on network uncertainty stop before the last confirmed lease deadline.
7. Collect the diff, meaningful verification results and structured report. A zero exit code alone does not satisfy acceptance criteria.
8. Create or reconcile the branch/PR using the execution journal, then submit a Builder handoff. Preserve branch, commit and PR evidence for the next role.
9. On failure or cancellation, stop the child process tree before relinquishing ownership. Keep recovery evidence and worktree changes.

The journal is crash recovery metadata, not a competing ticket database. Forge remains authoritative for ticket ownership and workflow.

## Backend work to resolve before unattended execution

- Dispatch currently requires an admin user session, while Gateway uses project/agent tokens. Define a supported renewable runner credential path with limited scope; do not give the local worker a database service-role key.
- Handoff performs separate writes and ignores several database errors. Make transitions and lease completion atomic, with retry-safe execution receipts. An HTTP timeout must not cause duplicated comments or ambiguous completion.
- Heartbeat reads then updates a lease by ID. Require ownership, active status and unexpired deadline in the mutation so cancellation cannot race with renewal.
- Define a typed, validated branch/commit/PR evidence contract. Current handoff code records note/report but does not consume dedicated PR fields.
- Enforce pause, per-project concurrency and schedule policy at a shared boundary. The documented weekday cadence is not implemented in the inspected dispatch function.
- Revalidate eligibility when claiming; account for a decision or dependency changing after selection.

## Delivery sequence and acceptance

1. **Read-only preflight:** show eligible work, blockers and missing local capabilities without reserving work. Verify against a dedicated test project and deployed schema.
2. **One execution:** manually run one approved Builder ticket through claim, worktree, worker, checks, PR and Review handoff. Record each transition and evidence.
3. **Recovery:** verify duplicate dispatch, expired ownership, network failure, process crash, lost handoff response and stop behavior. A restart must reconcile an existing execution before starting another.
4. **Forge controls:** display worker health, current ticket, last heartbeat, PR, blocker and explicit pause/stop/retry actions. Pause prevents new work; stop cancels current work; retry reconciles previous effects first.
5. **Scheduled operation:** enable the agreed calendar and multiple role executions only after recovery checks pass. Add more projects and concurrency later.

Use backend integration tests and a fake worker for lifecycle fault injection, then a real agent smoke run. Add browser verification for Forge UI changes. ARTEMIS exploration is required before authoring any Android tests; mobile execution is outside this first slice.

## Remaining facts to establish

- Which migrations/functions are deployed and which ORC tickets already track this work.
- Which project/ticket should be the pilot, with complete acceptance criteria.
- Which local agent runtime is installed and authorized for unattended runs.
- Where role-scoped credentials are provisioned and how runner authentication renews.
- Whether existing role and cadence terminology needs reconciliation (Runtime in ORC documents versus Browser in Gateway).

No production mutations, live ticket claims or runtime verification were performed during this source review.
