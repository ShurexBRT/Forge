import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import './styles.css'
import './v02.css'
import { AuthGate } from './components/AuthGate'
import { CreateProjectModal } from './components/CreateProjectModal'
import { CreateTicketModal } from './components/CreateTicketModal'
import { KanbanBoard } from './components/KanbanBoard'
import { Sidebar } from './components/Sidebar'
import { TicketPanel } from './components/TicketPanel'
import { Topbar } from './components/Topbar'
import { useForgeStore } from './store/forgeStore'
import type { Ticket } from './types'

interface ForgeWorkspaceProps {
  user: User | null
  signOut: () => Promise<void>
}

function ForgeWorkspace({ user, signOut }: ForgeWorkspaceProps) {
  const store = useForgeStore(user)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)

  useEffect(() => {
    if (!selectedTicket) return
    const fresh = store.tickets.find((ticket) => ticket.id === selectedTicket.id)
    if (fresh && fresh !== selectedTicket) setSelectedTicket(fresh)
    if (!fresh) setSelectedTicket(null)
  }, [store.tickets, selectedTicket])

  return (
    <div className="app-shell">
      <Sidebar
        projects={store.projects}
        activeProjectId={store.activeProjectId}
        mode={store.mode}
        userLabel={user?.email}
        onProjectChange={(id) => {
          store.setActiveProjectId(id)
          setSelectedTicket(null)
        }}
        onCreateProject={() => setCreatingProject(true)}
        onSignOut={store.mode === 'cloud' ? () => void signOut() : undefined}
      />

      <main className="main-area">
        {store.error && <div className="error-banner"><span>{store.error}</span><button type="button" onClick={store.clearError}>Dismiss</button></div>}

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
            <h2>Create the first Forge project</h2>
            <p>Projects isolate tickets, agent runs and repository context. Start with Forge itself or connect another repo.</p>
            <button className="primary-button" type="button" onClick={() => setCreatingProject(true)}>Create project</button>
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
      {creatingProject && <CreateProjectModal onClose={() => setCreatingProject(false)} onCreate={store.createProject} />}
    </div>
  )
}

export default function App() {
  return <AuthGate>{({ user, signOut }) => <ForgeWorkspace user={user} signOut={signOut} />}</AuthGate>
}
