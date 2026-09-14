import { describe, expect, it } from 'vitest'
import { nextTicketNumber, ticketsForProject, toggleCriterionDone } from '../src/lib/ticketLogic'
import type { Ticket } from '../src/types'

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'ticket-1',
    key: 'FOR-1',
    title: 'Example',
    description: '',
    projectId: 'forge',
    type: 'Task',
    priority: 'Medium',
    status: 'Ready',
    criteria: [{ id: 'criterion-1', text: 'Works', done: false }],
    stages: [],
    activity: [],
    comments: [],
    createdAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  }
}

describe('ticketsForProject', () => {
  it('keeps tickets isolated to the selected project', () => {
    const tickets = [
      ticket({ id: 'for-1', projectId: 'forge' }),
      ticket({ id: 'may-1', key: 'MAY-1', projectId: 'maylo' }),
    ]

    expect(ticketsForProject(tickets, 'forge').map((item) => item.id)).toEqual(['for-1'])
  })
})

describe('nextTicketNumber', () => {
  it('uses the highest numeric key in the project and ignores malformed keys', () => {
    const tickets = [
      ticket({ id: 'a', key: 'FOR-2' }),
      ticket({ id: 'b', key: 'FOR-7' }),
      ticket({ id: 'c', key: 'FOR-nope' }),
      ticket({ id: 'd', key: 'MAY-99', projectId: 'maylo' }),
    ]

    expect(nextTicketNumber(tickets, 'forge')).toBe(8)
  })

  it('starts a new project at ticket 1', () => {
    expect(nextTicketNumber([], 'forge')).toBe(1)
  })
})

describe('toggleCriterionDone', () => {
  it('toggles only the requested acceptance criterion without mutating the original ticket', () => {
    const original = ticket({
      criteria: [
        { id: 'criterion-1', text: 'One', done: false },
        { id: 'criterion-2', text: 'Two', done: true },
      ],
    })

    const updated = toggleCriterionDone(original, 'criterion-1')

    expect(updated.criteria).toEqual([
      { id: 'criterion-1', text: 'One', done: true },
      { id: 'criterion-2', text: 'Two', done: true },
    ])
    expect(original.criteria[0].done).toBe(false)
  })
})
