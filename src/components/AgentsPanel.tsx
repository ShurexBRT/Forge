import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, CircleHelp, GitBranch, ShieldCheck, X } from 'lucide-react'
import {
  fetchProjectGovernance,
  resolveDecisionRequest,
  setProjectAgentEnabled,
  updateProjectDirection,
} from '../services/governanceRepository'
import type { DecisionRequest, DirectionStatus, Project, ProjectAgent } from '../types'

interface AgentsPanelProps {
  project: Project
  isAdmin: boolean
  onClose: () => void
}

function directionLabel(status: DirectionStatus) {
  if (status === 'defined') return 'Direction defined'
  if (status === 'blocked_on_owner') return 'Blocked on owner'
  return 'Needs alignment'
}

function optionLabel(option: unknown) {
  if (typeof option === 'string') return option
  if (option && typeof option === 'object') {
    const candidate = option as Record<string, unknown>
    return String(candidate.label ?? candidate.title ?? candidate.value ?? JSON.stringify(option))
  }
  return String(option)
}

export function AgentsPanel({ project, isAdmin, onClose }: AgentsPanelProps) {
  const [agents, setAgents] = useState<ProjectAgent[]>([])
  const [decisions, setDecisions] = useState<DecisionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brief, setBrief] = useState('')
  const [pmNotes, setPmNotes] = useState('')
  const [directionStatus, setDirectionStatus] = useState<DirectionStatus>('needs_alignment')
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, { pmSummary: string; ownerDecision: string }>>({})

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProjectGovernance(project.id)
      setAgents(data.agents)
      setDecisions(data.decisions)
      if (data.direction) {
        setBrief(data.direction.productBrief)
        setPmNotes(data.direction.pmNotes)
        setDirectionStatus(data.direction.status)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load project governance.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [project.id])

  const openDecisions = useMemo(() => decisions.filter((decision) => decision.status === 'open'), [decisions])

  async function toggleAgent(item: ProjectAgent) {
    if (!isAdmin) return
    setSaving(true)
    setError(null)
    try {
      await setProjectAgentEnabled(project.id, item.agentId, !item.enabled)
      setAgents((current) => current.map((entry) => entry.agentId === item.agentId ? { ...entry, enabled: !entry.enabled } : entry))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update agent.')
    } finally {
      setSaving(false)
    }
  }

  async function saveDirection() {
    if (!isAdmin) return
    setSaving(true)
    setError(null)
    try {
      await updateProjectDirection({ projectId: project.id, status: directionStatus, productBrief: brief, pmNotes })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update product direction.')
    } finally {
      setSaving(false)
    }
  }

  async function resolveDecision(decision: DecisionRequest) {
    if (!isAdmin) return
    const draft = resolutionDrafts[decision.id]
    if (!draft?.ownerDecision.trim()) return
    setSaving(true)
    setError(null)
    try {
      await resolveDecisionRequest({ id: decision.id, pmSummary: draft.pmSummary.trim(), ownerDecision: draft.ownerDecision.trim() })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resolve decision request.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel-backdrop governance-backdrop" role="presentation">
      <section className="governance-panel" aria-label={`${project.name} agents and direction`}>
        <header className="governance-header">
          <div>
            <div className="governance-kicker"><Bot size={14} /> {project.key} · Agent control</div>
            <h2>{project.name}</h2>
            <p>Agent roster, product direction gate and owner decisions for this project.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close agent panel"><X size={18} /></button>
        </header>

        {error && <div className="auth-error governance-error">{error}</div>}

        {loading ? (
          <div className="admin-loading"><div className="workspace-spinner" /> Loading agent governance…</div>
        ) : (
          <div className="governance-content">
            <section className="governance-section">
              <div className="section-heading-row">
                <div>
                  <span className="section-eyebrow">Product direction gate</span>
                  <h3>{directionLabel(directionStatus)}</h3>
                </div>
                <span className={`direction-pill ${directionStatus}`}>{directionStatus.replaceAll('_', ' ')}</span>
              </div>

              {directionStatus !== 'defined' && (
                <div className="direction-warning">
                  <AlertTriangle size={17} />
                  <div><strong>Agents must not invent product direction.</strong><span>Broad product, UX or gameplay choices must be escalated to the PM, then aligned with the owner before implementation.</span></div>
                </div>
              )}

              <label className="governance-field">
                Status
                <select value={directionStatus} disabled={!isAdmin || saving} onChange={(event) => setDirectionStatus(event.target.value as DirectionStatus)}>
                  <option value="defined">Defined</option>
                  <option value="needs_alignment">Needs alignment</option>
                  <option value="blocked_on_owner">Blocked on owner</option>
                </select>
              </label>
              <label className="governance-field">
                Product brief
                <textarea value={brief} readOnly={!isAdmin} onChange={(event) => setBrief(event.target.value)} placeholder="What is this product, who is it for, and what must it become?" />
              </label>
              <label className="governance-field">
                PM notes
                <textarea value={pmNotes} readOnly={!isAdmin} onChange={(event) => setPmNotes(event.target.value)} placeholder="Constraints, unresolved direction, explicit non-goals…" />
              </label>
              {isAdmin && <button className="secondary-button" type="button" disabled={saving} onClick={() => void saveDirection()}>{saving ? 'Saving…' : 'Save direction'}</button>}
            </section>

            <section className="governance-section">
              <div className="section-heading-row">
                <div><span className="section-eyebrow">Project agents</span><h3>{agents.filter((agent) => agent.enabled).length} enabled</h3></div>
                <ShieldCheck size={18} className="section-icon" />
              </div>
              <div className="agent-registry-grid">
                {agents.map((item) => (
                  <article className={`agent-registry-card ${item.enabled ? 'enabled' : 'disabled'}`} key={item.agentId}>
                    <div className="agent-card-head">
                      <div className="agent-role-icon"><Bot size={15} /></div>
                      <div><strong>{item.agent.name}</strong><span>{item.agent.role} · prompt {item.agent.system_prompt_version}</span></div>
                      <button className={`agent-toggle ${item.enabled ? 'on' : ''}`} type="button" disabled={!isAdmin || saving} onClick={() => void toggleAgent(item)} aria-label={`${item.enabled ? 'Disable' : 'Enable'} ${item.agent.name}`}><span /></button>
                    </div>
                    <p>{item.agent.description}</p>
                    {item.specialization && <div className="agent-specialization"><GitBranch size={12} /> {item.specialization}</div>}
                  </article>
                ))}
              </div>
            </section>

            <section className="governance-section">
              <div className="section-heading-row">
                <div><span className="section-eyebrow">Decision queue</span><h3>{openDecisions.length} open</h3></div>
                <CircleHelp size={18} className="section-icon" />
              </div>

              {openDecisions.length === 0 ? (
                <div className="empty-decision"><CheckCircle2 size={18} /><span>No owner decision is blocking this project.</span></div>
              ) : (
                <div className="decision-list">
                  {openDecisions.map((decision) => {
                    const draft = resolutionDrafts[decision.id] ?? { pmSummary: '', ownerDecision: '' }
                    return (
                      <article className="decision-card" key={decision.id}>
                        <span className="decision-status">Owner decision required</span>
                        <h4>{decision.title}</h4>
                        {decision.context && <p>{decision.context}</p>}
                        <strong className="decision-question">{decision.question}</strong>
                        {decision.options.length > 0 && <div className="decision-options">{decision.options.map((option, index) => <span key={`${decision.id}-${index}`}>{optionLabel(option)}</span>)}</div>}
                        {isAdmin && (
                          <div className="decision-resolution">
                            <textarea placeholder="PM summary / recommendation" value={draft.pmSummary} onChange={(event) => setResolutionDrafts((current) => ({ ...current, [decision.id]: { ...draft, pmSummary: event.target.value } }))} />
                            <textarea placeholder="Owner decision" value={draft.ownerDecision} onChange={(event) => setResolutionDrafts((current) => ({ ...current, [decision.id]: { ...draft, ownerDecision: event.target.value } }))} />
                            <button className="primary-button" type="button" disabled={saving || !draft.ownerDecision.trim()} onClick={() => void resolveDecision(decision)}>Resolve decision</button>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  )
}
