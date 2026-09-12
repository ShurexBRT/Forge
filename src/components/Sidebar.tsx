import { Bot, Boxes, Settings2 } from 'lucide-react'
import type { Project } from '../types'

interface SidebarProps {
  projects: Project[]
  activeProjectId: string
  onProjectChange: (id: string) => void
}

export function Sidebar({ projects, activeProjectId, onProjectChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">F</div>
        <div>
          <strong>Forge</strong>
          <span>agent desk</span>
        </div>
      </div>

      <nav className="workspace-nav" aria-label="Workspace">
        <button className="nav-item active" type="button">
          <Boxes size={16} /> Projects
        </button>
        <button className="nav-item" type="button">
          <Bot size={16} /> Agents <span className="soon">soon</span>
        </button>
      </nav>

      <div className="sidebar-section-title">Projects</div>
      <div className="project-list">
        {projects.map((project) => (
          <button
            className={`project-item ${activeProjectId === project.id ? 'selected' : ''}`}
            key={project.id}
            onClick={() => onProjectChange(project.id)}
            type="button"
          >
            <span className="project-key">{project.key}</span>
            <span>{project.name}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="nav-item" type="button">
          <Settings2 size={16} /> Settings
        </button>
        <div className="version">Forge v0.1.0</div>
      </div>
    </aside>
  )
}
