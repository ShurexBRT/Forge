import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify, stripVTControlCharacters } from 'node:util'

const execute = promisify(execFile)
export class PreflightError extends Error {}
export type Check = { name: string; ok: boolean; detail: string }
export type Config = { url: string; project: string; repoPath: string; repository: string }
export type Candidate = {
  ticket_key: string; project_key: string; title: string; required_role: string | null
  eligible: boolean; blockers: string[]; warnings: string[]
}
export type Preview = { selected: Candidate | null; evaluations: Candidate[] }

export function readConfig(env: NodeJS.ProcessEnv, cwd: string): Config {
  const project = env.FORGE_PROJECT_KEY?.trim().toUpperCase() || 'ORC'
  if (!/^[A-Z][A-Z0-9_-]{0,31}$/.test(project)) throw new PreflightError('Invalid FORGE_PROJECT_KEY.')
  const repository = env.FORGE_REPOSITORY?.trim() || 'ShurexBRT/Forge'
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new PreflightError('FORGE_REPOSITORY must be owner/repository.')
  let url: URL
  try { url = new URL(env.FORGE_SUPABASE_URL || 'https://yljhffprkprbgjdaarqi.supabase.co') }
  catch { throw new PreflightError('Invalid FORGE_SUPABASE_URL.') }
  // Credentials only travel to the explicitly configured hosted Supabase project.
  if (url.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)
    || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new PreflightError('FORGE_SUPABASE_URL must be a hosted HTTPS Supabase project origin.')
  }
  return { url: url.origin, project, repoPath: resolve(cwd, env.FORGE_REPO_PATH || '.'), repository }
}

export function repositoryIdentity(remote: string): string | null {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)\/?$/.exec(remote.trim())
  return match ? match[1].replace(/\.git$/, '').toLowerCase() : null
}

export function isCodexAuthenticated(output: string): boolean {
  return /^Logged in\b/im.test(output)
}

export async function localChecks(config: Config): Promise<Check[]> {
  const checks: Check[] = []
  try {
    const [top, origin] = await Promise.all([
      execute('git', ['-C', config.repoPath, 'rev-parse', '--show-toplevel'], { timeout: 10_000, windowsHide: true }),
      execute('git', ['-C', config.repoPath, 'remote', 'get-url', 'origin'], { timeout: 10_000, windowsHide: true }),
    ])
    const root = await realpath(top.stdout.trim())
    const configured = await realpath(config.repoPath)
    const samePath = process.platform === 'win32' ? root.toLowerCase() === configured.toLowerCase() : root === configured
    const ok = samePath && repositoryIdentity(origin.stdout) === config.repository.toLowerCase()
    checks.push({ name: 'repository', ok, detail: ok ? config.repository : 'Repository root or origin does not match the configured allowlist.' })
  } catch { checks.push({ name: 'repository', ok: false, detail: 'Git repository or origin is unavailable.' }) }

  // Fixed command, no user-controlled shell interpolation. Windows npm shims need PowerShell.
  try {
    const result = process.platform === 'win32'
      ? await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'codex.cmd login status; exit $LASTEXITCODE'], { timeout: 15_000, windowsHide: true })
      : await execute('codex', ['login', 'status'], { timeout: 15_000 })
    const loggedIn = isCodexAuthenticated(result.stdout + result.stderr)
    checks.push({ name: 'codex', ok: loggedIn, detail: loggedIn ? 'Codex CLI reports an authenticated session; execution is not tested.' : 'Run codex login status locally to check authentication.' })
  } catch {
    checks.push({ name: 'codex', ok: false, detail: 'Codex authentication/configuration check failed. Run codex login status locally.' })
  }
  return checks
}

function jwtPayload(token: string): Record<string, unknown> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) throw new Error()
    const value: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value as Record<string, unknown>
  } catch { throw new PreflightError('FORGE_ACCESS_TOKEN must be a Supabase user access token.') }
}

export function readCredentials(env: NodeJS.ProcessEnv, config: Config, now = Date.now()) {
  const token = env.FORGE_ACCESS_TOKEN?.trim()
  const key = env.FORGE_PUBLISHABLE_KEY?.trim()
  if (!token || !key) throw new PreflightError('Preview requires FORGE_ACCESS_TOKEN and FORGE_PUBLISHABLE_KEY in the local environment. Do not paste credentials into chat.')
  const payload = jwtPayload(token)
  if (payload.role !== 'authenticated' || typeof payload.sub !== 'string' || !payload.sub
    || payload.iss !== `${config.url}/auth/v1`) throw new PreflightError('Use an authenticated user token from the configured Forge project, never a service-role key.')
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) throw new PreflightError('Forge user session expired. Refresh the local access token.')
  if (!/^sb_publishable_[\w-]+$/.test(key)) throw new PreflightError('FORGE_PUBLISHABLE_KEY must be a publishable key, never a secret/service-role key.')
  // These are local shape checks only. The server verifies signature, user and admin access.
  return { token, key }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(v => typeof v === 'string') }

export function parsePreview(value: unknown, project: string): Preview {
  const invalid = () => new PreflightError('Selector returned an invalid or out-of-project preview.')
  if (!record(value) || !Array.isArray(value.evaluations) || !('selected' in value)) throw invalid()
  function candidate(row: unknown): Candidate {
    if (!record(row) || row.project_key !== project || typeof row.ticket_key !== 'string'
      || !row.ticket_key.startsWith(`${project}-`) || !/^\d+$/.test(row.ticket_key.slice(project.length + 1)) || typeof row.title !== 'string'
      || (row.required_role !== null && typeof row.required_role !== 'string') || typeof row.eligible !== 'boolean'
      || !strings(row.blockers) || !strings(row.warnings)
      || (row.eligible && (row.blockers.length > 0 || !row.required_role))) throw invalid()
    return { ticket_key: row.ticket_key, project_key: project, title: row.title, required_role: row.required_role,
      eligible: row.eligible, blockers: row.blockers, warnings: row.warnings }
  }
  const evaluations = value.evaluations.map(candidate)
  if (new Set(evaluations.map(row => row.ticket_key)).size !== evaluations.length) throw invalid()
  const selected = value.selected === null ? null : candidate(value.selected)
  const firstEligible = evaluations.find(row => row.eligible) ?? null
  if (JSON.stringify(selected) !== JSON.stringify(firstEligible)) throw invalid()
  return { selected, evaluations }
}

export async function fetchPreview(config: Config, env: NodeJS.ProcessEnv, request: typeof fetch = fetch, timeoutMs = 15_000): Promise<Preview> {
  const { token, key } = readCredentials(env, config)
  try {
    const response = await request(`${config.url}/functions/v1/orchestrator-dry-run`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${token}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_key: config.project }),
    })
    // Never include raw HTTP bodies, headers or network exceptions in diagnostics.
    if (response.status === 401) throw new PreflightError('Forge rejected the session (401). Refresh your local access token.')
    if (response.status === 403) throw new PreflightError('Forge preview requires an admin session (403).')
    if (!response.ok) throw new PreflightError(`Forge preview failed (HTTP ${response.status}).`)
    return parsePreview(await response.json(), config.project)
  } catch (error) {
    if (error instanceof PreflightError) throw error
    throw new PreflightError('Forge preview could not be read. Check connectivity, timeout and endpoint availability.')
  }
}

export function redact(value: string, env: NodeJS.ProcessEnv): string {
  let output = value
  for (const name of ['FORGE_ACCESS_TOKEN', 'FORGE_PUBLISHABLE_KEY']) {
    const secret = env[name]?.trim()
    if (secret) output = output.split(secret).join('[redacted]')
  }
  return Array.from(stripVTControlCharacters(output)).filter(char => {
    const code = char.codePointAt(0)!
    return char === '\n' || char === '\t' || (code >= 32 && !(code >= 127 && code <= 159))
  }).join('')
}
