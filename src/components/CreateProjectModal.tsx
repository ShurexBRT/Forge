import { useState } from 'react'
import { X } from 'lucide-react'
import type { CreateProjectInput } from '../types'

interface CreateProjectModalProps {
  onClose: () => void
  onCreate: (input: CreateProjectInput) => void | Promise<void>
}

export function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [githubRepo, setGithubRepo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="create-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault()
          if (!key.trim() || !name.trim()) return
          setSubmitting(true)
          await onCreate({
            key: key.trim().toUpperCase(),
            name: name.trim(),
            description: description.trim(),
            githubRepo: githubRepo.trim() || undefined,
          })
          setSubmitting(false)
          onClose()
        }}
      >
        <div className="modal-header"><strong>New project</strong><button type="button" onClick={onClose}><X size={17} /></button></div>
        <input className="title-input" autoFocus placeholder="Project name" value={name} onChange={(event) => setName(event.target.value)} />
        <textarea placeholder="What is this project for?" value={description} onChange={(event) => setDescription(event.target.value)} />
        <div className="modal-fields project-fields">
          <label>Project key<input maxLength={10} placeholder="FOR" value={key} onChange={(event) => setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></label>
          <label>GitHub repo<input placeholder="ShurexBRT/Forge" value={githubRepo} onChange={(event) => setGithubRepo(event.target.value)} /></label>
        </div>
        <div className="modal-footer"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create project'}</button></div>
      </form>
    </div>
  )
}
