import { Bot, GitPullRequest, GripVertical } from 'lucide-react'
import type { Ticket } from '../types'

const prioritySymbol: Record<Ticket['priority'], string> = {
  Urgent: '!!!',
  High: '!!',
  Medium: '!',
  Low: '·',
}

interface TicketCardProps {
  ticket: Ticket
  onOpen: (ticket: Ticket) => void
}

export function TicketCard({ ticket, onOpen }: TicketCardProps) {
  const completed = ticket.criteria.filter((criterion) => criterion.done).length

  return (
    <button className="ticket-card" type="button" onClick={() => onOpen(ticket)}>
      <div className="ticket-meta-row">
        <span className="ticket-key">{ticket.key}</span>
        <span className={`priority priority-${ticket.priority.toLowerCase()}`}>{prioritySymbol[ticket.priority]}</span>
      </div>
      <h3>{ticket.title}</h3>
      <div className="ticket-footer-row">
        <div className="ticket-tags">
          <span className={`type-tag type-${ticket.type.toLowerCase()}`}>{ticket.type}</span>
          {ticket.pullRequest && <GitPullRequest size={14} aria-label="Pull request linked" />}
        </div>
        <div className="ticket-owner">
          {ticket.assignedAgent ? <><Bot size={13} /> {ticket.assignedAgent}</> : <span>Unassigned</span>}
        </div>
      </div>
      {ticket.criteria.length > 0 && (
        <div className="criterion-progress">
          <span>{completed}/{ticket.criteria.length}</span>
          <div><i style={{ width: `${(completed / ticket.criteria.length) * 100}%` }} /></div>
        </div>
      )}
      <GripVertical className="drag-hint" size={15} />
    </button>
  )
}
