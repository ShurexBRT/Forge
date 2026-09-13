import type { User } from '@supabase/supabase-js'
import { ShieldCheck, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fetchAdminAccessData, setProjectMembership } from '../services/adminRepository'
import type { Project, ProjectMembership, UserProfile } from '../types'

interface AdminPanelProps {
  currentUser: User
  projects: Project[]
  onClose: () => void
}

export function AdminPanel({ currentUser, projects, onClose }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [memberships, setMemberships] = useState<ProjectMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const membershipSet = useMemo(
    () => new Set(memberships.map((membership) => `${membership.userId}:${membership.projectId}`)),
    [memberships],
  )

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminAccessData()
      setUsers(data.users)
      setMemberships(data.memberships)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load admin access data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function toggleProject(userId: string, projectId: string) {
    const key = `${userId}:${projectId}`
    const assigned = !membershipSet.has(key)
    setSavingKey(key)
    setError(null)

    try {
      await setProjectMembership(projectId, userId, assigned, currentUser)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update project access.')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="panel-backdrop admin-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="admin-panel" role="dialog" aria-modal="true" aria-label="Forge admin" onMouseDown={(event) => event.stopPropagation()}>
        <header className="admin-header">
          <div>
            <div className="admin-kicker"><ShieldCheck size={15} /> Workspace admin</div>
            <h2>User access</h2>
            <p>New users start with no projects. Assign only the workspaces they should see.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close admin panel"><X size={19} /></button>
        </header>

        {error && <div className="auth-error admin-error">{error}</div>}

        {loading ? (
          <div className="admin-loading"><div className="workspace-spinner" /> Loading users and memberships…</div>
        ) : (
          <div className="admin-users">
            {users.map((user) => {
              const isAdmin = user.role === 'admin'
              return (
                <article className="admin-user-card" key={user.id}>
                  <div className="admin-user-head">
                    <div className="admin-avatar"><UserRound size={17} /></div>
                    <div>
                      <strong>{user.displayName || user.email}</strong>
                      {user.displayName && <span>{user.email}</span>}
                    </div>
                    <span className={`role-pill ${isAdmin ? 'admin' : ''}`}>{user.role}</span>
                  </div>

                  {isAdmin ? (
                    <div className="admin-all-access"><ShieldCheck size={14} /> Admin has access to every project.</div>
                  ) : (
                    <div className="project-access-grid">
                      {projects.map((project) => {
                        const key = `${user.id}:${project.id}`
                        const checked = membershipSet.has(key)
                        const saving = savingKey === key
                        return (
                          <label className={`project-access-item ${checked ? 'checked' : ''}`} key={project.id}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={saving}
                              onChange={() => void toggleProject(user.id, project.id)}
                            />
                            <span className="project-key">{project.key}</span>
                            <span>{project.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
