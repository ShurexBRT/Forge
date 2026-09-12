import { Bot, Boxes, Cloud, HardDrive, LogOut, Plus, Settings2 } from 'lucide-react'
import type { ForgeMode, Project } from '../types'

interface SidebarProps {
  projects: Project[]
  activeProjectId: string
  mode: ForgeMode
  userLabel?: string
  onProjectChange: (id: string) => void
  onCreateProject: () => void
  onSignOut?: () => void
}

export function Sidebar({ projects, activeProjectId, mode, userLabel, onProjectChange, onCreateProject, onSignOut }: SidebarProps) {
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

      <div className="sidebar-section-title sidebar-section-row">
        <span>Projects</span>
        <button type="button" onClick={onCreateProject} aria-label="Create project"><Plus size={13} /></button>
      </div>
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
        <div className="connection-state">
          {mode === 'cloud' ? <Cloud size={13} /> : <HardDrive size={13} />}
          <div><strong>{mode === 'cloud' ? 'Cloud' : 'Demo'}</strong><span>{mode === 'cloud' ? userLabel : 'Local browser data'}</span></div>
        </div>
        <button className="nav-item" type="button">
          <Settings2 size={16} /> Settings
        </button>
        {mode === 'cloud' && onSignOut && <button className="nav-item" type="button" onClick={onSignOut}><LogOut size={16} /> Sign out</button>}
        <div className="version">Forge v0.2.0</div>
      </div>
    </aside>
  )
}
