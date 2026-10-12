# Forge local runner — first slice

Read-only ticket tooling for ORC-34. It checks a local repository and Codex login, then optionally calls the existing admin-only selector. It cannot claim, dispatch, start an agent, update a ticket or create a PR.

## Run

Use Node 22.18+ (or Node 24+) from the Forge repository root after `npm install`. No build is required. The login flow uses Forge's existing Supabase client dependency.

```powershell
node orchestrator/runner/cli.ts doctor
node orchestrator/runner/cli.ts doctor --json
node orchestrator/runner/cli.ts connect
```

`connect` prints a local `http://127.0.0.1:<port>` URL. Open it in your browser, enter your existing Forge email and password, and submit. The runner authenticates against the configured Forge Supabase project, calls only the selector, displays the preview and closes the listener. Credentials are held in memory, never written to a file or printed; the temporary session is signed out with local scope (existing browser sessions are not signed out). The form expires after 15 minutes. Ctrl+C cancels it. The Forge publishable key defaults to the same public key used by the existing deployment; custom projects must supply their own.

The loopback server validates Host, form Origin and a random form nonce. It rejects cross-origin submissions, enforces a 16 KiB body limit and serves script-free, non-cacheable HTML with escaped ticket text. Top-level navigation from another site is allowed. `Referrer-Policy: same-origin` preserves the form POST Origin needed for validation.

For environments already provisioning an access token, use the original command:

```powershell
Copy-Item orchestrator/runner/.env.example .env.runner.local
# Edit .env.runner.local locally; never share its credentials in chat.
node --env-file=.env.runner.local orchestrator/runner/cli.ts preview
node --env-file=.env.runner.local orchestrator/runner/cli.ts preview --json
```

The env file is covered by the repository `.env.*` ignore rule. Browser login does not automatically authenticate this separate process. `connect` removes the need to copy tokens. Neither command persistently stores or refreshes a session; unattended worker authentication remains future work.

Configuration:

| Variable | Purpose |
| --- | --- |
| `FORGE_PROJECT_KEY` | Exactly one project; default `ORC` |
| `FORGE_REPOSITORY` | Allowed GitHub owner/repository; default `ShurexBRT/Forge` |
| `FORGE_REPO_PATH` | Repository root; defaults to current directory |
| `FORGE_SUPABASE_URL` | Hosted HTTPS project origin; defaults to Forge |
| `FORGE_PUBLISHABLE_KEY` | Publishable key for that Supabase project |
| `FORGE_ACCESS_TOKEN` | Unexpired admin user JWT; never a service-role key or agent token |

`doctor` returns exit code 1 when a prerequisite fails. `preview` returns 1 on configuration, repository, authentication, transport or response-contract failure. A valid empty queue returns 0. Codex login failure is displayed but does not prevent a read-only preview. Selection remains the server's responsibility; local tooling does not invent or rerank work. Eligible means server-eligible, not that a local worker is ready.

Requests have a 15-second timeout, refuse redirects and never retry mutations (there are no mutation calls). Project scoping is checked both in the request and response. Raw API errors and command stderr are not printed. Codex is probed only with `login status`; no model invocation occurs.

## Verification and next steps

`npm test` includes contract and failure-path tests in `tests/orchestratorPreflight.test.ts` and real loopback HTTP boundary tests in `tests/orchestratorConnect.test.ts`. `npm run runner:typecheck` checks the Node-specific TypeScript separately from the frontend.

Live authenticated selector verification requires local credentials. Tests with mock responses do not prove deployed behavior. Follow `docs/ORCHESTRATOR-RUNNER-PLAN.md` for the later worker lifecycle and backend recovery work. Do not enable unattended execution based on this preflight alone.
