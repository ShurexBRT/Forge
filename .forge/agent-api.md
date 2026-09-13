# Forge agent runtime

Project key: `FOR`
Gateway: `https://yljhffprkprbgjdaarqi.supabase.co/functions/v1/agent-gateway`
Secret: `FORGE_AGENT_TOKEN`

Before work, read `AGENTS.md`, `.forge/project.json`, and `docs/AGENT-GATEWAY.md`.

Standard loop: `next_ticket` -> `claim` -> work -> `handoff`.

If product intent is unclear, use `decision_request` and return `BLOCKED`. Never invent product direction to unblock yourself. Never store or print the raw agent token.