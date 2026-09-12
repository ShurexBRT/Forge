# Forge

Forge is a lean, AI-agent-first engineering ticket desk inspired by the speed and clarity of modern issue trackers, but designed around explicit agent roles, handoffs, QA evidence, and GitHub-linked delivery.

## Why Forge

General-purpose ticket tools treat agents like users. Forge treats agents like constrained engineering roles with explicit permissions, stage ownership and evidence requirements.

## MVP features

- Project-aware Kanban board
- Ticket types and priorities
- Acceptance criteria
- Agent pipeline: Planner → Builder → Reviewer → QA → Browser → Release
- Ticket activity timeline
- Local persistence
- GitHub Pages deployment workflow
- Agent operating contract in `AGENTS.md`

## Stack

React · TypeScript · Vite

Supabase and GitHub integration are planned after the local interaction model is validated.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Workflow philosophy

A Builder cannot approve its own work. A QA pass requires evidence. A passing build does not equal a verified user flow. Tickets carry the workflow state; GitHub carries the code state.
