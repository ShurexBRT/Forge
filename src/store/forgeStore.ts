import { useEffect, useMemo, useState } from 'react'
import { projects, seedTickets } from '../data/seed'
import type { Project, Ticket, TicketStatus } from '../types'

const STORAGE_KEY = 'forge:tickets:v1'

function loadTickets(): Ticket[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as Ticket[]) : seedTickets
  } catch {
    return seedTickets
  }
}

export function useForgeStore() {
  const [tickets, setTickets] = useState<Ticket[]>(loadTickets)
  const [activeProjectId, setActiveProjectId] = useState<string>('forge')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets))
  }, [tickets])

  const activeProject = useMemo<Project>(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0],
    [activeProjectId],
  )

  const visibleTickets = useMemo(
    () => tickets.filter((ticket) => ticket.projectId === activeProject.id),
    [tickets, activeProject.id],
  )

  function updateTicket(ticketId: string, updater: (ticket: Ticket) => Ticket) {
    setTickets((current) => current.map((ticket) => (ticket.id === ticketId ? updater(ticket) : ticket)))
  }

  function moveTicket(ticketId: string, status: TicketStatus) {
    updateTicket(ticketId, (ticket) => ({
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

  function toggleCriterion(ticketId: string, criterionId: string) {
    updateTicket(ticketId, (ticket) => ({
      ...ticket,
      criteria: ticket.criteria.map((criterion) =>
        criterion.id === criterionId ? { ...criterion, done: !criterion.done } : criterion,
      ),
    }))
  }

  function addTicket(input: Pick<Ticket, 'title' | 'description' | 'type' | 'priority'>) {
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
    return ticket
  }

  return {
    projects,
    tickets,
    visibleTickets,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    moveTicket,
    toggleCriterion,
    addTicket,
  }
}
