import type { Project, Ticket, TicketStatus } from '../types'

export const statuses: TicketStatus[] = [
  'Backlog',
  'Ready',
  'In Progress',
  'Review',
  'QA',
  'Ready to Release',
  'Done',
]

export const projects: Project[] = [
  {
    id: 'maylo',
    key: 'MAY',
    name: 'Maylo',
    description: 'Multilingual local services marketplace',
    githubRepo: 'ShurexBRT/Maylo',
  },
  {
    id: 'forge',
    key: 'FOR',
    name: 'Forge',
    description: 'AI-agent-first engineering ticket desk',
  },
]

const pipeline = () => [
  { role: 'Planner' as const, status: 'passed' as const },
  { role: 'Builder' as const, status: 'active' as const },
  { role: 'Reviewer' as const, status: 'pending' as const },
  { role: 'QA' as const, status: 'pending' as const },
  { role: 'Browser' as const, status: 'pending' as const },
  { role: 'Release' as const, status: 'pending' as const },
]

export const seedTickets: Ticket[] = [
  {
    id: 'for-1',
    key: 'FOR-1',
    title: 'Ship Forge MVP ticket board',
    description: 'Build the first usable Forge board with projects, tickets, agent stages and activity history.',
    projectId: 'forge',
    type: 'Feature',
    priority: 'Urgent',
    status: 'In Progress',
    assignedAgent: 'Builder',
    branch: 'feat/FOR-1-forge-mvp',
    criteria: [
      { id: 'c1', text: 'Kanban board shows all workflow statuses', done: true },
      { id: 'c2', text: 'Ticket detail panel exposes agent pipeline', done: true },
      { id: 'c3', text: 'Ticket changes persist locally', done: false },
      { id: 'c4', text: 'GitHub Pages workflow is included', done: false },
    ],
    stages: pipeline(),
    activity: [
      { id: 'a1', actor: 'Planner', action: 'Defined MVP scope and workflow', timestamp: 'Today · 20:42' },
      { id: 'a2', actor: 'Builder', action: 'Started implementation', timestamp: 'Today · 20:51' },
    ],
    createdAt: '2026-09-12T20:35:00+02:00',
  },
  {
    id: 'may-142',
    key: 'MAY-142',
    title: 'Provider image upload fails after replacement',
    description: 'Replacing an existing provider image may leave UI state ahead of the persisted backend state.',
    projectId: 'maylo',
    type: 'Bug',
    priority: 'High',
    status: 'QA',
    assignedAgent: 'QA',
    branch: 'fix/MAY-142-provider-image-upload',
    pullRequest: '#287',
    criteria: [
      { id: 'c5', text: 'Image can be uploaded', done: true },
      { id: 'c6', text: 'Existing image can be replaced', done: true },
      { id: 'c7', text: 'Unauthorized replacement is handled', done: false },
      { id: 'c8', text: 'Mobile flow verified', done: true },
    ],
    stages: [
      { role: 'Planner', status: 'passed' },
      { role: 'Builder', status: 'passed' },
      { role: 'Reviewer', status: 'passed' },
      { role: 'QA', status: 'failed', note: 'Unauthorized replacement returns a generic server error.' },
      { role: 'Browser', status: 'pending' },
      { role: 'Release', status: 'pending' },
    ],
    activity: [
      { id: 'a3', actor: 'Reviewer', action: 'Approved implementation for QA', timestamp: 'Yesterday · 17:20' },
      { id: 'a4', actor: 'QA', action: 'Failed unauthorized replacement scenario', timestamp: 'Today · 09:12' },
    ],
    createdAt: '2026-09-10T10:00:00+02:00',
  },
  {
    id: 'may-143',
    key: 'MAY-143',
    title: 'Normalize search language filter behavior',
    description: 'Ensure multi-language filter state is consistent between search results and restored navigation state.',
    projectId: 'maylo',
    type: 'Task',
    priority: 'Medium',
    status: 'Review',
    assignedAgent: 'Reviewer',
    criteria: [
      { id: 'c9', text: 'Multiple languages remain selected after back navigation', done: true },
      { id: 'c10', text: 'Search query uses stable language identifiers', done: true },
    ],
    stages: [
      { role: 'Planner', status: 'passed' },
      { role: 'Builder', status: 'passed' },
      { role: 'Reviewer', status: 'active' },
      { role: 'QA', status: 'pending' },
      { role: 'Browser', status: 'pending' },
      { role: 'Release', status: 'pending' },
    ],
    activity: [{ id: 'a5', actor: 'Builder', action: 'Submitted implementation for review', timestamp: 'Today · 15:32' }],
    createdAt: '2026-09-11T13:15:00+02:00',
  },
]
