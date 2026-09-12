# Forge

Forge is a lean, AI-agent-first engineering ticket desk inspired by the speed and clarity of modern issue trackers, but designed around explicit agent roles, handoffs, QA evidence, and GitHub-linked delivery.

## Why Forge

General-purpose ticket tools treat agents like users. Forge treats agents like constrained engineering roles with explicit permissions, stage ownership and evidence requirements.

## Current capabilities

- Project-aware Kanban board
- Ticket types and priorities
- Acceptance criteria
- Agent pipeline: Planner → Builder → Reviewer → QA → Browser → Release
- Agent run notes and reports
- Ticket comments
- Ticket activity timeline
- Demo mode with local browser persistence
- Cloud mode with Supabase Auth + Postgres + RLS
- Secure project ownership model for browser users
- GitHub Pages deployment workflow
- Agent operating contract in `AGENTS.md`
- Agent data contract in `docs/AGENT-DATA-CONTRACT.md`

## Stack

React · TypeScript · Vite · Supabase · GitHub Pages

## Data modes

### Demo mode

If Supabase environment variables are absent, Forge uses local seed data and `localStorage`. This is useful for frontend development and interaction testing.

### Cloud mode

If both variables below are present, Forge enables Supabase Auth and persists projects, tickets, criteria, comments, activity and agent runs in Postgres.

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Never expose a Supabase secret/service-role key in a `VITE_*` variable.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without `.env.local`, Forge simply starts in Demo mode.

## Production build

```bash
npm run build
```

GitHub Pages reads browser-safe Supabase values from repository variables named `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Supabase setup

`supabase/schema.sql` contains the reviewed v0.2 schema draft. It is intentionally not recorded as a migration until it has been applied to the dedicated Forge Supabase project, verified with real queries, and checked with Supabase security/performance advisors.

## Workflow philosophy

A Builder cannot approve its own work. A QA pass requires evidence. A passing build does not equal a verified user flow. Tickets carry the workflow state; GitHub carries the code state; agent runs carry execution evidence.
