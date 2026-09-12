import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type {
  AgentRole,
  AgentStage,
  CreateProjectInput,
  Priority,
  Project,
  StageStatus,
  Ticket,
  TicketComment,
  TicketStatus,
  TicketType,
} from '../types'

const AGENT_ROLES: AgentRole[] = ['Planner', 'Builder', 'Reviewer', 'QA', 'Browser', 'Release']

interface ProjectRow {
  id: string
  key: string
  name: string
  description: string
  github_repo: string | null
  created_at: string
}

interface CriterionRow {
  id: string
  text: string
  done: boolean
  sort_order: number
}

interface CommentRow {
  id: string
  author_name: string
  author_type: 'human' | 'agent' | 'system'
  body: string
  created_at: string
}

interface AgentRunRow {
  id: string
  role: AgentRole
  status: StageStatus
  note: string | null
  report: string | null
  created_at: string
}

interface ActivityRow {
  id: string
  actor_name: string
  action: string
  created_at: string
}

interface TicketRow {
  id: string
  ticket_number: number
  project_id: string
  title: string
  description: string
  type: TicketType
  priority: Priority
  status: TicketStatus
  assigned_agent: AgentRole | null
  branch: string | null
  pull_request: string | null
  created_at: string
  acceptance_criteria?: CriterionRow[]
  ticket_comments?: CommentRow[]
  agent_runs?: AgentRunRow[]
  ticket_activity?: ActivityRow[]
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function displayTimestamp(timestamp: string) {
  const value = new Date(timestamp)
  const deltaSeconds = Math.max(0, Math.round((Date.now() - value.getTime()) / 1000))

  if (deltaSeconds < 60) return 'Just now'
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}m ago`
  if (deltaSeconds < 86400) return `${Math.floor(deltaSeconds / 3600)}h ago`
  return value.toLocaleDateString()
}

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    githubRepo: row.github_repo ?? undefined,
    createdAt: row.created_at,
  }
}

function stagesFromRuns(runs: AgentRunRow[] = []): AgentStage[] {
  const latest = new Map<AgentRole, AgentStage>()
  const ordered = [...runs].sort((a, b) => a.created_at.localeCompare(b.created_at))

  for (const run of ordered) {
    latest.set(run.role, {
      role: run.role,
      status: run.status,
      note: run.note ?? undefined,
      report: run.report ?? undefined,
    })
  }

  return AGENT_ROLES.map((role) => latest.get(role) ?? { role, status: 'pending' })
}

function commentsFromRows(rows: CommentRow[] = []): TicketComment[] {
  return [...rows]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((row) => ({
      id: row.id,
      author: row.author_name,
      authorType: row.author_type,
      body: row.body,
      createdAt: row.created_at,
    }))
}

function ticketFromRow(row: TicketRow, project: Project): Ticket {
  return {
    id: row.id,
    key: `${project.key}-${row.ticket_number}`,
    title: row.title,
    description: row.description,
    projectId: row.project_id,
    type: row.type,
    priority: row.priority,
    status: row.status,
    assignedAgent: row.assigned_agent ?? undefined,
    branch: row.branch ?? undefined,
    pullRequest: row.pull_request ?? undefined,
    criteria: [...(row.acceptance_criteria ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((criterion) => ({ id: criterion.id, text: criterion.text, done: criterion.done })),
    stages: stagesFromRuns(row.agent_runs),
    comments: commentsFromRows(row.ticket_comments),
    activity: [...(row.ticket_activity ?? [])]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((item) => ({
        id: item.id,
        actor: item.actor_name,
        action: item.action,
        timestamp: displayTimestamp(item.created_at),
      })),
    createdAt: row.created_at,
  }
}

export async function fetchForgeData() {
  const db = client()
  const { data: projectData, error: projectError } = await db
    .from('projects')
    .select('id,key,name,description,github_repo,created_at')
    .order('created_at', { ascending: true })

  if (projectError) throw projectError

  const projects = (projectData as ProjectRow[]).map(projectFromRow)
  if (projects.length === 0) return { projects, tickets: [] as Ticket[] }

  const { data: ticketData, error: ticketError } = await db
    .from('tickets')
    .select(`
      id,ticket_number,project_id,title,description,type,priority,status,assigned_agent,branch,pull_request,created_at,
      acceptance_criteria(id,text,done,sort_order),
      ticket_comments(id,author_name,author_type,body,created_at),
      agent_runs(id,role,status,note,report,created_at),
      ticket_activity(id,actor_name,action,created_at)
    `)
    .order('created_at', { ascending: false })

  if (ticketError) throw ticketError

  const projectById = new Map(projects.map((project) => [project.id, project]))
  const tickets = (ticketData as TicketRow[]).flatMap((row) => {
    const project = projectById.get(row.project_id)
    return project ? [ticketFromRow(row, project)] : []
  })

  return { projects, tickets }
}

export async function createProject(input: CreateProjectInput, user: User) {
  const db = client()
  const { data, error } = await db
    .from('projects')
    .insert({
      key: input.key.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description.trim(),
      github_repo: input.githubRepo?.trim() || null,
      created_by: user.id,
    })
    .select('id,key,name,description,github_repo,created_at')
    .single()

  if (error) throw error
  return projectFromRow(data as ProjectRow)
}

export async function createTicket(
  project: Project,
  input: Pick<Ticket, 'title' | 'description' | 'type' | 'priority'>,
  user: User,
) {
  const db = client()
  const { error } = await db.from('tickets').insert({
    project_id: project.id,
    title: input.title.trim(),
    description: input.description.trim(),
    type: input.type,
    priority: input.priority,
    status: 'Backlog',
    created_by: user.id,
  })

  if (error) throw error
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus) {
  const db = client()
  const { error } = await db.from('tickets').update({ status }).eq('id', ticketId)
  if (error) throw error
}

export async function updateCriterion(ticketId: string, criterionId: string, done: boolean) {
  const db = client()
  const { error } = await db
    .from('acceptance_criteria')
    .update({ done })
    .eq('id', criterionId)
    .eq('ticket_id', ticketId)

  if (error) throw error
}

export async function addTicketComment(ticketId: string, body: string, user: User) {
  const db = client()
  const authorName = user.email?.split('@')[0] || 'Human'
  const { error } = await db.from('ticket_comments').insert({
    ticket_id: ticketId,
    author_id: user.id,
    author_name: authorName,
    author_type: 'human',
    body: body.trim(),
  })

  if (error) throw error
}
