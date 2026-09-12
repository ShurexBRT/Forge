import { useState } from 'react'
import { Bot, Check, Circle, GitBranch, GitPullRequest, Send, X, XCircle } from 'lucide-react'
import type { Ticket } from '../types'

interface TicketPanelProps {
  ticket: Ticket
  onClose: () => void
  onToggleCriterion: (ticketId: string, criterionId: string) => void | Promise<void>
  onAddComment: (ticketId: string, body: string) => void | Promise<void>
}

const stageIcon = (status: string) => {
  if (status === 'passed') return <Check size={13} />
  if (status === 'failed') return <XCircle size={13} />
  if (status === 'active') return <Bot size={13} />
  return <Circle size={11} />
}

export function TicketPanel({ ticket, onClose, onToggleCriterion, onAddComment }: TicketPanelProps) {
  const [comment, setComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const comments = ticket.comments ?? []

  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <aside className="ticket-panel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-toolbar">
          <span>{ticket.key}</span>
          <button type="button" onClick={onClose} aria-label="Close ticket"><X size={17} /></button>
        </div>

        <div className="panel-content">
          <div className="panel-badges">
            <span className={`type-tag type-${ticket.type.toLowerCase()}`}>{ticket.type}</span>
            <span className={`priority-pill priority-${ticket.priority.toLowerCase()}`}>{ticket.priority}</span>
            <span className="status-pill">{ticket.status}</span>
          </div>

          <h2>{ticket.title}</h2>
          <p className="ticket-description">{ticket.description}</p>

          <div className="ticket-links">
            {ticket.branch && <span><GitBranch size={14} /> {ticket.branch}</span>}
            {ticket.pullRequest && <span><GitPullRequest size={14} /> {ticket.pullRequest}</span>}
          </div>

          <section className="panel-section">
            <div className="section-heading">Acceptance criteria <span>{ticket.criteria.filter((item) => item.done).length}/{ticket.criteria.length}</span></div>
            <div className="criteria-list">
              {ticket.criteria.length === 0 && <div className="muted">No acceptance criteria yet.</div>}
              {ticket.criteria.map((criterion) => (
                <label className="criterion-row" key={criterion.id}>
                  <input type="checkbox" checked={criterion.done} onChange={() => void onToggleCriterion(ticket.id, criterion.id)} />
                  <span>{criterion.text}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading">Agent pipeline</div>
            <div className="agent-pipeline">
              {ticket.stages.map((stage) => (
                <div className={`agent-stage stage-${stage.status}`} key={stage.role}>
                  <div className="stage-icon">{stageIcon(stage.status)}</div>
                  <div>
                    <strong>{stage.role}</strong>
                    <span>{stage.status}</span>
                    {stage.note && <p>{stage.note}</p>}
                    {stage.report && <details className="stage-report"><summary>Report</summary><p>{stage.report}</p></details>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading">Comments <span>{comments.length}</span></div>
            <div className="comment-list">
              {comments.length === 0 && <div className="muted">No comments yet.</div>}
              {comments.map((item) => (
                <div className={`comment-item comment-${item.authorType}`} key={item.id}>
                  <div className="comment-meta"><strong>{item.author}</strong><span>{new Date(item.createdAt).toLocaleString()}</span></div>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
            <form
              className="comment-form"
              onSubmit={async (event) => {
                event.preventDefault()
                if (!comment.trim()) return
                setSubmittingComment(true)
                await onAddComment(ticket.id, comment.trim())
                setComment('')
                setSubmittingComment(false)
              }}
            >
              <textarea placeholder="Add a comment or handoff note…" value={comment} onChange={(event) => setComment(event.target.value)} />
              <button className="secondary-button" type="submit" disabled={submittingComment || !comment.trim()}><Send size={13} /> {submittingComment ? 'Sending…' : 'Comment'}</button>
            </form>
          </section>

          <section className="panel-section">
            <div className="section-heading">Activity</div>
            <div className="activity-list">
              {ticket.activity.map((item) => (
                <div className="activity-item" key={item.id}>
                  <span className="activity-dot" />
                  <div><strong>{item.actor}</strong> {item.action}<small>{item.timestamp}</small></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
