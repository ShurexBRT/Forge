import { useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, RefreshCcw, ShieldX } from 'lucide-react'
import { issueAgentCredential, listAgentCredentials, revokeAgentCredential } from '../services/governanceRepository'
import type { AgentCredentialSummary, ProjectAgent } from '../types'

interface AgentCredentialsProps {
  projectId: string
  agents: ProjectAgent[]
  isAdmin: boolean
}

export function AgentCredentials({ projectId, agents, isAdmin }: AgentCredentialsProps) {
  const [credentials, setCredentials] = useState<AgentCredentialSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ agentName: string; token: string } | null>(null)

  async function load() {
    if (!isAdmin) return
    setLoading(true)
    setError(null)
    try {
      setCredentials(await listAgentCredentials(projectId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load agent credentials.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [projectId, isAdmin])

  const byAgent = useMemo(() => {
    const map = new Map<string, AgentCredentialSummary[]>()
    for (const credential of credentials) {
      const list = map.get(credential.agentId) ?? []
      list.push(credential)
      map.set(credential.agentId, list)
    }
    return map
  }, [credentials])

  async function issue(item: ProjectAgent) {
    setError(null)
    setIssued(null)
    try {
      const credential = await issueAgentCredential(projectId, item.agentId, `${item.agent.slug}-primary`)
      setIssued({ agentName: item.agent.name, token: credential.token })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not issue agent key.')
    }
  }

  async function revoke(credential: AgentCredentialSummary) {
    setError(null)
    try {
      await revokeAgentCredential(credential.id)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not revoke agent key.')
    }
  }

  if (!isAdmin) return null

  return (
    <section className="governance-section credential-section">
      <div className="section-heading-row">
        <div><span className="section-eyebrow">Agent access keys</span><h3>Gateway credentials</h3></div>
        <button className="icon-button compact-icon-button" type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh keys"><RefreshCcw size={14} /></button>
      </div>
      <p className="credential-help">Keys are scoped to one project and one agent role. Forge stores only the SHA-256 hash. Raw keys are shown once and belong in the agent secret store, never in Git.</p>
      {error && <div className="auth-error">{error}</div>}
      {issued && (
        <div className="issued-token">
          <div><strong>{issued.agentName} key issued</strong><span>Copy it now. Forge cannot show this raw key again.</span></div>
          <code>{issued.token}</code>
          <button className="secondary-button" type="button" onClick={() => void navigator.clipboard.writeText(issued.token)}><Copy size={13} /> Copy key</button>
        </div>
      )}
      <div className="credential-list">
        {agents.map((item) => {
          const rows = byAgent.get(item.agentId) ?? []
          return (
            <article className="credential-agent" key={item.agentId}>
              <div className="credential-agent-head">
                <div><strong>{item.agent.name}</strong><span>{item.enabled ? 'enabled' : 'disabled'} · {rows.filter((row) => row.active).length} active key(s)</span></div>
                <button className="secondary-button mini-button" type="button" disabled={!item.enabled || loading} onClick={() => void issue(item)}><KeyRound size={12} /> Issue key</button>
              </div>
              {rows.length > 0 && (
                <div className="credential-rows">
                  {rows.map((row) => (
                    <div className={`credential-row ${row.active ? '' : 'revoked'}`} key={row.id}>
                      <code>{row.tokenPrefix}…</code>
                      <span>{row.active ? (row.lastUsedAt ? `used ${new Date(row.lastUsedAt).toLocaleString()}` : 'never used') : 'revoked'}</span>
                      {row.active && <button type="button" onClick={() => void revoke(row)} aria-label="Revoke key"><ShieldX size={13} /></button>}
                    </div>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
