import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import './styles.css'
import './v02.css'
import './mobile.css'
import './admin.css'
import './governance.css'
import { AdminPanel } from './components/AdminPanel'
import { AgentsPanel } from './components/AgentsPanel'
import { AuthGate } from './components/AuthGate'
import { CreateProjectModal } from './components/CreateProjectModal'
import { CreateTicketModal } from './components/CreateTicketModal'
import { KanbanBoard } from './components/KanbanBoard'
import { Sidebar } from './components/Sidebar'
import { TicketPanel } from './components/TicketPanel'
import { Topbar } from './components/Topbar'
import { fetchCurrentProfile } from './services/adminRepository'
import { useForgeStore } from './store/forgeStore'
import type { Ticket, UserProfile } from './types'

interface ForgeWorkspaceProps {
  user: User | null
  signOut: () => Promise<void>
}

function ForgeWorkspace({ user, signOut }: ForgeWorkspaceProps) {
  const store = useForgeStore(user)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [agentsOpen, setAgentsOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const isAdmin = store.mode === 'demo' || profile?.role === 'admin'

  useEffect(() => {
    if (store.mode !== 'cloud' || !user) {
      setProfile(null)
      setProfileError(null)
      return
    }

    let cancelled = false
    void fetchCurrentProfile(user.id)
      .then((nextProfile) => {
        if (!cancelled) setProfile(nextProfile)
      })
      .catch((cause) => {
        if (!cancelled) setProfileError(cause instanceof Error ? cause.message : 'Could not load user profile.')
      })

    return () => {
      cancelled = true
    }
  }, [store.mode, user])

  useEffect(() => {
    if (!selectedTicket) return
    const fresh = store.tickets.find((ticket) => ticket.id === selectedTicket.id)
    if (fresh && fresh !== selectedTicket) setSelectedTicket(fresh)
    if (!fresh) setSelectedTicket(null)
  }, [store.tickets, selectedTicket])

  useEffect(() => {
    setAgentsOpen(false)
  }, [store.activeProjectId])

  return (
    <div className="app-shell">
      <Sidebar
        projects={store.projects}
        activeProjectId={store.activeProjectId}
        mode={store.mode}
        userLabel={user?.email}
        isAdmin={isAdmin}
        onProjectChange={(id) => {
          store.setActiveProjectId(id)
          setSelectedTicket(null)
        }}
        onCreateProject={isAdmin ? () => setCreatingProject(true) : undefined}
        onOpenAgents={store.activeProject ? () => setAgentsOpen(true) : undefined}
        onOpenAdmin={store.mode === 'cloud' && isAdmin ? () => setAdminOpen(true) : undefined}
        onSignOut={store.mode === 'cloud' ? () => void signOut() : undefined}
      />

      <main className="main-area">
        {(store.error || profileError) && (
          <div className="error-banner">
            <span>{store.error || profileError}</span>
            <button type="button" onClick={() => { store.clearError(); setProfileError(null) }}>Dismiss</button>
          </div>
        )}

        {store.loading ? (
          <div className="workspace-state"><div className="workspace-spinner" /><h2>Loading Forge</h2><p>Pulling projects, tickets and agent history.</p></div>
        ) : store.activeProject ? (
          <>
            <Topbar projectName={store.activeProject.name} projectDescription={store.activeProject.description} onCreate={() => setCreatingTicket(true)} />
            <KanbanBoard tickets={store.visibleTickets} onOpenTicket={setSelectedTicket} onMoveTicket={store.moveTicket} />
          </>
        ) : (
          <div className="workspace-state">
            <div className="empty-forge-mark">F</div>
            <h2>{isAdmin ? 'Create the first Forge project' : 'No projects assigned yet'}</h2>
            <p>
              {isAdmin
                ? 'Projects isolate tickets, agent runs and repository context. Create a project or connect another repo.'
                : 'Your Forge account is active, but an admin has not assigned any projects to you yet.'}
            </p>
            {isAdmin && <button className="primary-button" type="button" onClick={() => setCreatingProject(true)}>Create project</button>}
          </div>
        )}
      </main>

      {selectedTicket && (
        <TicketPanel
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onToggleCriterion={store.toggleCriterion}
          onAddComment={store.addComment}
        />
      )}
      {creatingTicket && <CreateTicketModal onClose={() => setCreatingTicket(false)} onCreate={store.addTicket} />}
      {creatingProject && isAdmin && <CreateProjectModal onClose={() => setCreatingProject(false)} onCreate={store.createProject} />}
      {adminOpen && user && isAdmin && <AdminPanel currentUser={user} projects={store.projects} onClose={() => setAdminOpen(false)} />}
      {agentsOpen && store.activeProject && <AgentsPanel project={store.activeProject} isAdmin={isAdmin} onClose={() => setAgentsOpen(false)} />}
    </div>
  )
}

export default function App() {
  return <AuthGate>{({ user, signOut }) => <ForgeWorkspace user={user} signOut={signOut} />}</AuthGate>
}
