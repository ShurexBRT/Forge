import { statuses } from '../data/seed'
import type { Ticket, TicketStatus } from '../types'
import { TicketCard } from './TicketCard'

interface KanbanBoardProps {
  tickets: Ticket[]
  onOpenTicket: (ticket: Ticket) => void
  onMoveTicket: (id: string, status: TicketStatus) => void
}

export function KanbanBoard({ tickets, onOpenTicket, onMoveTicket }: KanbanBoardProps) {
  return (
    <div className="kanban-scroll">
      <div className="kanban-board">
        {statuses.map((status) => {
          const columnTickets = tickets.filter((ticket) => ticket.status === status)
          return (
            <section className="kanban-column" key={status}>
              <header className="column-header">
                <div className="column-title">
                  <span className={`status-dot status-${status.toLowerCase().replaceAll(' ', '-')}`} />
                  {status}
                </div>
                <span className="column-count">{columnTickets.length}</span>
              </header>
              <div className="column-stack">
                {columnTickets.map((ticket) => (
                  <div key={ticket.id}>
                    <TicketCard ticket={ticket} onOpen={onOpenTicket} />
                    <select
                      className="quick-move"
                      value={ticket.status}
                      aria-label={`Move ${ticket.key}`}
                      onChange={(event) => onMoveTicket(ticket.id, event.target.value as TicketStatus)}
                    >
                      {statuses.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </div>
                ))}
                {columnTickets.length === 0 && <div className="empty-column">No tickets</div>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
