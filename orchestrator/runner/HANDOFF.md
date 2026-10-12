# Local preflight handoff — 2026-10-12

Result: BLOCKED pending the user's local login for live authenticated verification; local preflight and login implemented.

Ticket context: ORC-34, read in full together with acceptance criteria, comments and existing runs. This implementation does not complete the larger dispatch ticket or claim independent review/QA.

## Changed

- Added a dependency-free Node TypeScript CLI with `doctor` and `preview` commands.
- Added hosted-project URL, repository-origin and response-project validation.
- Added short-lived user-session shape/expiry checks, request timeout, redirect refusal and sanitized diagnostics.
- Preserved server selection order and blocker explanations; no dispatch/claim API is called.
- Added runner-specific typechecking to CI, Node type definitions and npm lockfile.
- Updated stale dependency descriptions in orchestrator documentation.
- Added `connect`: a temporary loopback login form using the existing Supabase client. The form submits credentials locally, authenticates against Forge, reads the selector, signs out only its own temporary session and closes. No credentials are persisted.
- Fixed Windows CLI probing to use `codex.cmd`, and avoid treating `Not logged in` as successful authentication.

## Verification performed

- `npm run lint`: passed.
- `npm run runner:typecheck`: passed.
- `npm test`: 32 tests passed across four files, including real loopback HTTP security and lifecycle tests.
- `npm run build`: passed.
- `git diff --check`: passed.
- Native Node CLI help: passed.
- Native Node doctor: repository identity and Codex authentication passed.
- Native Node preview without credentials: rejected with a sanitized missing-credentials error and no work claim.
- Supabase connector: Forge project is active; dry-run v3, dispatch v1 and agent-gateway v4 are listed active. This is deployment metadata, not authenticated invocation proof.
- Browser: existing Forge tab shows CLOUD / ADMIN. No browser credentials were extracted or exported.
- Browser form verification: an isolated loopback server with a fake authenticator accepted dummy form input and rendered the expected success state. This proves the corrected browser form transport, not real Forge authentication.
- A real login attempt exposed an Origin-policy issue. Fixed `Referrer-Policy` to `same-origin` and allowed top-level cross-site GET navigation while retaining strict POST Origin/nonce validation. Real login retry is pending.

## Blockers and next actions

1. Resolved: removed the single incompatible `service_tier = "default"` line from the user's Codex configuration after creating a timestamped backup beside it. `codex login status` reports ChatGPT authentication. No model execution or model/tier selection was performed.
2. `connect` now provides a local login flow without copying tokens. A real server is awaiting user input; the latest URL was provided in chat. Servers expire after 15 minutes; restart `npm run runner:connect` if needed. Do not extract browser storage or forge admin JWTs through database/management access.
3. Run authenticated preview against the configured project, verify server selection/blockers, and record evidence through the authorized Forge interface when credentials are available.
4. Implement later lifecycle stages only according to `docs/ORCHESTRATOR-RUNNER-PLAN.md`, including atomic handoff, lease recovery and stop behavior. No worker, scheduler, mutation or PR creation is implemented by this slice.

Next owner: Reviewer for local implementation; user for local login, then runtime verification. No ticket statuses or acceptance checkboxes were changed. No commits were pushed and nothing was deployed.
