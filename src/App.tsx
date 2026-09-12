import { useEffect, useState } from 'react'
import './styles.css'
import { CreateTicketModal } from './components/CreateTicketModal'
import { KanbanBoard } from './components/KanbanBoard'
import { Sidebar } from './components/Sidebar'
import { TicketPanel } from './components/TicketPanel'
import { Topbar } from './components/Topbar'
import { useForgeStore } from './store/forgeStore'
import type { Ticket } from './types'

export default function App() {
  const store = useForgeStore()
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!selectedTicket) return
    const fresh = store.tickets.find((ticket) => ticket.id === selectedTicket.id)
    if (fresh && fresh !== selectedTicket) setSelectedTicket(fresh)
  }, [store.tickets, selectedTicket])

  return (
    <div className="app-shell">
      <Sidebar projects={store.projects} activeProjectId={store.activeProjectId} onProjectChange={(id) => {
        store.setActiveProjectId(id)
        setSelectedTicket(null)
      }} />
      <main className="main-area">
        <Topbar projectName={store.activeProject.name} projectDescription={store.activeProject.description} onCreate={() => setCreating(true)} />
        <KanbanBoard tickets={store.visibleTickets} onOpenTicket={setSelectedTicket} onMoveTicket={store.moveTicket} />
      </main>

      {selectedTicket && (
        <TicketPanel ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onToggleCriterion={store.toggleCriterion} />
      )}
      {creating && <CreateTicketModal onClose={() => setCreating(false)} onCreate={store.addTicket} />}
    </div>
  )
}
