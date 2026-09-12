import type { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { projects as seedProjects, seedTickets } from '../data/seed'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  addTicketComment,
  createProject as createCloudProject,
  createTicket as createCloudTicket,
  fetchForgeData,
  updateCriterion,
  updateTicketStatus,
} from '../services/forgeRepository'
import type { CreateProjectInput, ForgeMode, Project, Ticket, TicketStatus } from '../types'

const STORAGE_KEY = 'forge:tickets:v1'

function loadDemoTickets(): Ticket[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const tickets = saved ? (JSON.parse(saved) as Ticket[]) : seedTickets
    return tickets.map((ticket) => ({ ...ticket, comments: ticket.comments ?? [] }))
  } catch {
    return seedTickets.map((ticket) => ({ ...ticket, comments: ticket.comments ?? [] }))
  }
}

export function useForgeStore(user: User | null) {
  const mode: ForgeMode = isSupabaseConfigured ? 'cloud' : 'demo'
  const [projects, setProjects] = useState<Project[]>(() => (mode === 'demo' ? seedProjects : []))
  const [tickets, setTickets] = useState<Ticket[]>(() => (mode === 'demo' ? loadDemoTickets() : []))
  const [activeProjectId, setActiveProjectId] = useState<string>(() => (mode === 'demo' ? 'forge' : ''))
  const [loading, setLoading] = useState(mode === 'cloud')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'demo') localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets))
  }, [mode, tickets])

  const refresh = useCallback(async () => {
    if (mode !== 'cloud' || !user) return

    setLoading(true)
    setError(null)
    try {
      const data = await fetchForgeData()
      setProjects(data.projects)
      setTickets(data.tickets)
      setActiveProjectId((current) => {
        if (current && data.projects.some((project) => project.id === current)) return current
        return data.projects[0]?.id ?? ''
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load Forge data.')
    } finally {
      setLoading(false)
    }
  }, [mode, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const activeProject = useMemo<Project | undefined>(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0],
    [activeProjectId, projects],
  )

  const visibleTickets = useMemo(
    () => (activeProject ? tickets.filter((ticket) => ticket.projectId === activeProject.id) : []),
    [tickets, activeProject],
  )

  function updateDemoTicket(ticketId: string, updater: (ticket: Ticket) => Ticket) {
    setTickets((current) => current.map((ticket) => (ticket.id === ticketId ? updater(ticket) : ticket)))
  }

  async function moveTicket(ticketId: string, status: TicketStatus) {
    if (mode === 'cloud') {
      try {
        setError(null)
        await updateTicketStatus(ticketId, status)
        await refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not move ticket.')
      }
      return
    }

    updateDemoTicket(ticketId, (ticket) => ({
      ...ticket,
      status,
      activity: [
        {
          id: crypto.randomUUID(),
          actor: 'Human',
          action: `Moved ticket to ${status}`,
          timestamp: 'Just now',
        },
        ...ticket.activity,
      ],
    }))
  }

  async function toggleCriterion(ticketId: string, criterionId: string) {
    const ticket = tickets.find((item) => item.id === ticketId)
    const criterion = ticket?.criteria.find((item) => item.id === criterionId)
    if (!criterion) return

    if (mode === 'cloud') {
      try {
        setError(null)
        await updateCriterion(ticketId, criterionId, !criterion.done)
        await refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not update acceptance criterion.')
      }
      return
    }

    updateDemoTicket(ticketId, (current) => ({
      ...current,
      criteria: current.criteria.map((item) =>
        item.id === criterionId ? { ...item, done: !item.done } : item,
      ),
    }))
  }

  async function addTicket(input: Pick<Ticket, 'title' | 'description' | 'type' | 'priority'>) {
    if (!activeProject) return

    if (mode === 'cloud') {
      if (!user) return
      try {
        setError(null)
        await createCloudTicket(activeProject, input, user)
        await refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not create ticket.')
      }
      return
    }

    const projectTickets = tickets.filter((ticket) => ticket.projectId === activeProject.id)
    const numbers = projectTickets
      .map((ticket) => Number(ticket.key.split('-')[1]))
      .filter((value) => Number.isFinite(value))
    const nextNumber = (numbers.length ? Math.max(...numbers) : 0) + 1

    const ticket: Ticket = {
      id: crypto.randomUUID(),
      key: `${activeProject.key}-${nextNumber}`,
      projectId: activeProject.id,
      status: 'Backlog',
      criteria: [],
      comments: [],
      stages: [
        { role: 'Planner', status: 'pending' },
        { role: 'Builder', status: 'pending' },
        { role: 'Reviewer', status: 'pending' },
        { role: 'QA', status: 'pending' },
        { role: 'Browser', status: 'pending' },
        { role: 'Release', status: 'pending' },
      ],
      activity: [{ id: crypto.randomUUID(), actor: 'Human', action: 'Created ticket', timestamp: 'Just now' }],
      createdAt: new Date().toISOString(),
      ...input,
    }

    setTickets((current) => [ticket, ...current])
  }

  async function createProject(input: CreateProjectInput) {
    if (mode === 'cloud') {
      if (!user) return
      try {
        setError(null)
        const project = await createCloudProject(input, user)
        await refresh()
        setActiveProjectId(project.id)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not create project.')
      }
      return
    }

    const project: Project = {
      id: crypto.randomUUID(),
      key: input.key.trim().toUpperCase(),
      name: input.name.trim(),
      description: input.description.trim(),
      githubRepo: input.githubRepo?.trim() || undefined,
      createdAt: new Date().toISOString(),
    }
    setProjects((current) => [...current, project])
    setActiveProjectId(project.id)
  }

  async function addComment(ticketId: string, body: string) {
    const trimmed = body.trim()
    if (!trimmed) return

    if (mode === 'cloud') {
      if (!user) return
      try {
        setError(null)
        await addTicketComment(ticketId, trimmed, user)
        await refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not add comment.')
      }
      return
    }

    updateDemoTicket(ticketId, (ticket) => ({
      ...ticket,
      comments: [
        ...(ticket.comments ?? []),
        {
          id: crypto.randomUUID(),
          author: 'Human',
          authorType: 'human',
          body: trimmed,
          createdAt: new Date().toISOString(),
        },
      ],
    }))
  }

  return {
    mode,
    loading,
    error,
    clearError: () => setError(null),
    projects,
    tickets,
    visibleTickets,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    moveTicket,
    toggleCriterion,
    addTicket,
    createProject,
    addComment,
    refresh,
  }
}
