import { Command, Plus, Search } from 'lucide-react'

interface TopbarProps {
  projectName: string
  projectDescription: string
  onCreate: () => void
}

export function Topbar({ projectName, projectDescription, onCreate }: TopbarProps) {
  return (
    <header className="topbar">
      <div>
        <h1>{projectName}</h1>
        <p>{projectDescription}</p>
      </div>
      <div className="topbar-actions">
        <button className="search-button" type="button">
          <Search size={15} /> Search <span><Command size={12} /> K</span>
        </button>
        <button className="primary-button" type="button" onClick={onCreate}>
          <Plus size={16} /> New ticket
        </button>
      </div>
    </header>
  )
}
