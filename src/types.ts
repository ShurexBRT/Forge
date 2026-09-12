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
