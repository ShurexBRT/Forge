import { useState } from 'react'
import { X } from 'lucide-react'
import type { Priority, TicketType } from '../types'

interface CreateTicketModalProps {
  onClose: () => void
  onCreate: (input: { title: string; description: string; type: TicketType; priority: Priority }) => void
}

export function CreateTicketModal({ onClose, onCreate }: CreateTicketModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<TicketType>('Task')
  const [priority, setPriority] = useState<Priority>('Medium')

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="create-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          if (!title.trim()) return
          onCreate({ title: title.trim(), description: description.trim(), type, priority })
          onClose()
        }}
      >
        <div className="modal-header"><strong>New ticket</strong><button type="button" onClick={onClose}><X size={17} /></button></div>
        <input className="title-input" autoFocus placeholder="Ticket title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea placeholder="Describe the problem, goal and expected behavior..." value={description} onChange={(event) => setDescription(event.target.value)} />
        <div className="modal-fields">
          <label>Type<select value={type} onChange={(event) => setType(event.target.value as TicketType)}><option>Bug</option><option>Feature</option><option>Task</option></select></label>
          <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option>Urgent</option><option>High</option><option>Medium</option><option>Low</option></select></label>
        </div>
        <div className="modal-footer"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Create ticket</button></div>
      </form>
    </div>
  )
}
