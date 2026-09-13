export type TicketStatus =
  | 'Backlog'
  | 'Ready'
  | 'In Progress'
  | 'Review'
  | 'QA'
  | 'Ready to Release'
  | 'Done'

export type TicketType = 'Bug' | 'Feature' | 'Task'
export type Priority = 'Urgent' | 'High' | 'Medium' | 'Low'
export type AgentRole = 'Planner' | 'Builder' | 'Reviewer' | 'QA' | 'Browser' | 'Release'
export type StageStatus = 'pending' | 'active' | 'passed' | 'failed'
export type ForgeMode = 'demo' | 'cloud'
export type UserRole = 'admin' | 'member'
export type ProjectAccessRole = 'member' | 'manager'
export type DirectionStatus = 'defined' | 'needs_alignment' | 'blocked_on_owner'
export type DecisionStatus = 'open' | 'resolved' | 'dismissed'

export interface AcceptanceCriterion {
  id: string
  text: string
  done: boolean
}

export interface AgentStage {
  role: AgentRole
  status: StageStatus
  note?: string
  report?: string
}

export interface ActivityItem {
  id: string
  actor: string
  action: string
  timestamp: string
}

export interface TicketComment {
  id: string
  author: string
  authorType: 'human' | 'agent' | 'system'
  body: string
  createdAt: string
}

export interface Ticket {
  id: string
  key: string
  title: string
  description: string
  projectId: string
  type: TicketType
  priority: Priority
  status: TicketStatus
  assignedAgent?: AgentRole
  branch?: string
  pullRequest?: string
  criteria: AcceptanceCriterion[]
  stages: AgentStage[]
  activity: ActivityItem[]
  comments?: TicketComment[]
  createdAt: string
}

export interface Project {
  id: string
  key: string
  name: string
  description: string
  githubRepo?: string
  createdAt?: string
}

export interface CreateProjectInput {
  key: string
  name: string
  description: string
  githubRepo?: string
}

export interface UserProfile {
  id: string
  email: string
  displayName?: string
  role: UserRole
  createdAt: string
}

export interface ProjectMembership {
  projectId: string
  userId: string
  accessRole: ProjectAccessRole
  assignedAt: string
}

export interface AgentDefinition {
  id: string
  slug: string
  name: string
  role: AgentRole
  description: string
  status: 'active' | 'disabled'
  system_prompt_version: string
  default_permissions: Record<string, unknown>
}

export interface ProjectAgent {
  projectId: string
  agentId: string
  enabled: boolean
  specialization: string
  permissions: Record<string, unknown>
  agent: AgentDefinition
}

export interface ProjectDirection {
  projectId: string
  status: DirectionStatus
  productBrief: string
  pmNotes: string
  lastAlignedAt: string | null
  updatedAt: string
}

export interface DecisionRequest {
  id: string
  projectId: string
  ticketId: string | null
  requestedByAgentId: string | null
  title: string
  context: string
  question: string
  options: unknown[]
  status: DecisionStatus
  pmSummary: string
  ownerDecision: string
  createdAt: string
  resolvedAt: string | null
  updatedAt: string
}

export interface AgentCredentialSummary {
  id: string
  projectId: string
  agentId: string
  label: string
  tokenPrefix: string
  active: boolean
  lastUsedAt: string | null
  createdAt: string
  revokedAt: string | null
}

export interface IssuedAgentCredential extends AgentCredentialSummary {
  token: string
}
