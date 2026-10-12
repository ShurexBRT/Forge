# Forge local runner

Local tooling for ORC-34 with read-only preflight and a manually invoked single-Builder execution path. No scheduled dispatch is enabled. The worker implementation is covered by lifecycle tests; a real eligible-ticket-to-PR run still requires verification.

## Run

Use Node 22.18+ (or Node 24+) from the Forge repository root after `npm install`. No build is required. The login flow uses Forge's existing Supabase client dependency.

```powershell
node orchestrator/runner/cli.ts doctor
node orchestrator/runner/cli.ts doctor --json
node orchestrator/runner/cli.ts connect
```

`connect` prints a local `http://127.0.0.1:6910` URL. Open it in your browser, enter your existing Forge email and password, and submit. The runner authenticates against the configured Forge Supabase project, calls only the selector, displays the preview and closes the listener. Credentials are held in memory, never written to a file or printed; the temporary session is signed out with local scope (existing browser sessions are not signed out). The form expires after 60 minutes. Ctrl+C cancels it. The Forge publishable key defaults to the same public key used by the existing deployment; custom projects must supply their own.

The loopback server validates Host, form Origin and a random form nonce. It rejects cross-origin submissions, enforces a 16 KiB body limit and serves script-free, non-cacheable HTML with escaped ticket text. Top-level navigation from another site is allowed. `Referrer-Policy: same-origin` preserves the form POST Origin needed for validation.

For environments already provisioning an access token, use the original command:

```powershell
Copy-Item orchestrator/runner/.env.example .env.runner.local
# Edit .env.runner.local locally; never share its credentials in chat.
node --env-file=.env.runner.local orchestrator/runner/cli.ts preview
node --env-file=.env.runner.local orchestrator/runner/cli.ts preview --json
```

The env file is covered by the repository `.env.*` ignore rule. Browser login does not automatically authenticate this separate process. `connect` removes the need to copy user tokens. Agent access is separate and described below.

Configuration:

| Variable | Purpose |
| --- | --- |
| `FORGE_PROJECT_KEY` | Exactly one project; default `ORC` |
| `FORGE_REPOSITORY` | Allowed GitHub owner/repository; default `ShurexBRT/Forge` |
| `FORGE_REPO_PATH` | Repository root; defaults to current directory |
| `FORGE_SUPABASE_URL` | Hosted HTTPS project origin; defaults to Forge |
| `FORGE_PUBLISHABLE_KEY` | Publishable key for that Supabase project |
| `FORGE_ACCESS_TOKEN` | Unexpired admin user JWT; never a service-role key or agent token |
| `FORGE_AGENT_TOKEN` | Optional externally provisioned project/role agent token; overrides encrypted local storage |
| `FORGE_AGENT_ROLE` | `Builder` (default) or `QA` for inspect; run always requires Builder |

`doctor` returns exit code 1 when a prerequisite fails. `preview` returns 1 on configuration, repository, authentication, transport or response-contract failure. A valid empty queue returns 0. Codex login failure is displayed but does not prevent a read-only preview. Selection remains the server's responsibility; local tooling does not invent or rerank work. Eligible means server-eligible, not that a local worker is ready.

Requests have a 15-second timeout, refuse redirects and never retry mutations automatically. Project scoping is checked both in the request and response. Raw API errors and command stderr are not printed. `doctor`, `preview`, `connect` and `inspect` never invoke a model; `run` does.

## Authorize a role

```powershell
node orchestrator/runner/cli.ts authorize QA
node orchestrator/runner/cli.ts authorize Builder
```

Run one authorization at a time. The local form explicitly asks the operator to grant project/role access. It issues a credential through the existing `agent-admin` function, encrypts it with Windows DPAPI for the current user, and stores ciphertext under `.forge-runner/credentials/`. The directory is Git-ignored. The admin password/session is not persisted. Revoke the key in Forge's Agent access keys when it is no longer needed. Existing local credentials are not silently overwritten; inspect/revoke them before provisioning a replacement. Non-Windows hosts may supply a token through their secret environment instead.

Authorization success only means the role credential was saved. It does not start or unblock a ticket.

## Inspect and run

```powershell
$env:FORGE_AGENT_ROLE = 'QA'
node orchestrator/runner/cli.ts inspect ORC-40
# After Builder authorization and with an eligible, approved Builder ticket:
node orchestrator/runner/cli.ts run ORC-123
```

Replace ORC-123 with an actual approved ticket. `run` requires a clean checkout, matching GitHub origin, Codex and gh login, and `.forge/runner.json`. That file specifies the base ref, required npm scripts and worker timeout. The first adapter supports npm projects. It uses the locally installed Codex CLI with workspace-write sandboxing and no interactive approval fallback.

The runner reads the full ticket, checks Builder ownership and blockers, records claim intent, claims through Gateway, and creates a unique branch/worktree. A separate heartbeat loop guards ownership. The agent receives the ticket context and repository instructions, without Forge tokens in its environment. It may implement and report, but does not publish or update Forge itself. The runner installs dependencies with lifecycle scripts disabled, runs the configured checks, commits, pushes and creates a draft PR. It then submits Builder evidence and confirms the ticket is in Review. PR links are included in the report; dedicated ticket branch/PR fields are not currently written by Gateway.

Model output PASS alone is insufficient: configured commands must succeed. Independent review, acceptance verification, browser QA where applicable and release remain downstream responsibilities.

## Stop and recovery

Ctrl+C aborts the current child process tree. Heartbeat failure or a lease approaching expiry also aborts work. Journals, worktrees and any PR are retained under `.forge-runner/`.

`runner.lock` prevents concurrent local executions. A journal is written before claim, and a previous journal prevents automatic rerun of that ticket. On ambiguous claim, push, PR or handoff results, the state becomes `needs_reconciliation`; no remote mutation is blindly retried and ownership is not prematurely released. The lease can expire server-side. After a crash, inspect the journal, live Gateway state, local worktree and GitHub branch/PR before explicitly removing a stale lock or archiving a journal. Do not remove another live worker's lock. There is no automatic resume command yet.

The Gateway currently performs handoff as separate writes. The runner verifies final state and stops on inconsistency, but does not make those backend writes transactional. Atomic backend transitions and retry receipts remain required before unattended operation.

## Verification and next steps

`npm test` includes contract and failure-path tests in `tests/orchestratorPreflight.test.ts` and real loopback HTTP boundary tests in `tests/orchestratorConnect.test.ts`. `npm run runner:typecheck` checks the Node-specific TypeScript separately from the frontend.

Live user-authenticated selector verification passed and reported existing ORC blockers. Agent Gateway mutation verification and a real Codex-to-PR pilot remain separate gates. Lifecycle tests use fake Gateway/worker ports; Windows process termination and DPAPI encryption are also tested with real local processes. Follow `docs/ORCHESTRATOR-RUNNER-PLAN.md` for remaining backend recovery work. Do not enable unattended execution based on these checks alone.
