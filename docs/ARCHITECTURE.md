# Forge Architecture v0.1

## Goal

Forge is a focused ticket and workflow control plane for human + AI engineering teams. It intentionally does not attempt to clone Linear/Jira feature-for-feature.

## Current MVP

- React + TypeScript + Vite
- Static-host friendly frontend for GitHub Pages
- LocalStorage persistence for the first runnable slice
- Project switching
- Kanban workflow
- Ticket creation and ticket detail surface
- Acceptance criteria
- Agent pipeline states
- Activity trail

## Planned persistence layer

Supabase is the intended backend once the interaction model is validated:

- Postgres: projects, tickets, criteria, comments, activities, agent_runs
- Auth: human users and service identities
- Realtime: ticket/status/activity updates
- Storage: screenshots and ticket attachments
- Edge Functions: secure GitHub/webhook/agent actions

The GitHub Pages client must never contain service-role credentials or other server-side secrets.

## Principle

Ticket = work truth
Repository/PR = code truth
Agent contract = execution rules
API/MCP = communication layer
