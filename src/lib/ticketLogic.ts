import type { Ticket } from '../types'

export function ticketsForProject(tickets: Ticket[], projectId: string): Ticket[] {
  return tickets.filter((ticket) => ticket.projectId === projectId)
}

export function nextTicketNumber(tickets: Ticket[], projectId: string): number {
  const numbers = ticketsForProject(tickets, projectId)
    .map((ticket) => Number(ticket.key.split('-')[1]))
    .filter((value) => Number.isFinite(value))

  return (numbers.length ? Math.max(...numbers) : 0) + 1
}

export function toggleCriterionDone(ticket: Ticket, criterionId: string): Ticket {
  return {
    ...ticket,
    criteria: ticket.criteria.map((criterion) =>
      criterion.id === criterionId ? { ...criterion, done: !criterion.done } : criterion,
    ),
  }
}
