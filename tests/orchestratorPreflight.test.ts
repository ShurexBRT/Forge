import { describe, expect, it, vi } from 'vitest'
import { fetchPreview, isCodexAuthenticated, parsePreview, readConfig, readCredentials, redact, repositoryIdentity } from '../orchestrator/runner/preflight'

const config = readConfig({}, process.cwd())
const token = (overrides: Record<string, unknown> = {}) => `header.${Buffer.from(JSON.stringify({ role: 'authenticated', sub: 'test-user', iss: `${config.url}/auth/v1`, exp: Math.floor(Date.now() / 1000) + 3600, ...overrides })).toString('base64url')}.signature`
const env = () => ({ FORGE_ACCESS_TOKEN: token(), FORGE_PUBLISHABLE_KEY: 'sb_publishable_test' })
const row = { ticket_key: 'ORC-34', project_key: 'ORC', title: 'Preview', required_role: 'Builder', eligible: true, blockers: [], warnings: [] }

describe('runner trust boundaries', () => {
  it('does not mistake logged-out Codex for an authenticated session', () => {
    expect(isCodexAuthenticated('Not logged in')).toBe(false)
    expect(isCodexAuthenticated('Logged in using ChatGPT\n')).toBe(true)
  })
  it('refuses credential-bearing, redirect-like and non-HTTPS origins', () => {
    for (const url of ['http://localhost', 'https://evil.example', `${config.url}/other`, `${config.url}?token=x`, `https://user:password@${new URL(config.url).hostname}`]) {
      expect(() => readConfig({ FORGE_SUPABASE_URL: url }, '.')).toThrow()
    }
  })
  it('normalizes supported GitHub remotes without accepting foreign hosts or credentials', () => {
    expect(repositoryIdentity('https://github.com/ShurexBRT/Forge.git')).toBe('shurexbrt/forge')
    expect(repositoryIdentity('git@github.com:ShurexBRT/Forge.git')).toBe('shurexbrt/forge')
    expect(repositoryIdentity('https://github.com.evil.test/ShurexBRT/Forge')).toBeNull()
    expect(repositoryIdentity('https://token@github.com/ShurexBRT/Forge')).toBeNull()
  })
  it('rejects missing, expired, privileged and other-project sessions before network use', () => {
    expect(() => readCredentials({}, config)).toThrow('requires')
    for (const claims of [{ exp: 0 }, { role: 'service_role' }, { iss: 'https://other.supabase.co/auth/v1' }]) {
      expect(() => readCredentials({ ...env(), FORGE_ACCESS_TOKEN: token(claims) }, config)).toThrow()
    }
    expect(() => readCredentials({ ...env(), FORGE_PUBLISHABLE_KEY: 'sb_secret_no' }, config)).toThrow()
  })
  it('rejects cross-project, inconsistent and duplicated selector results', () => {
    for (const response of [
      { selected: row, evaluations: [{ ...row, project_key: 'OTHER' }] },
      { selected: row, evaluations: [] },
      { selected: null, evaluations: [row] },
      { selected: row, evaluations: [row, row] },
      { selected: { ...row, blockers: ['blocked'] }, evaluations: [row] },
    ]) expect(() => parsePreview(response, 'ORC')).toThrow()
    expect(parsePreview({ selected: null, evaluations: [] }, 'ORC')).toEqual({ selected: null, evaluations: [] })
  })
  it('retains a blocked ticket with no resolvable role', () => {
    const blocked = { ...row, eligible: false, required_role: null, blockers: ['No role can be resolved.'] }
    expect(parsePreview({ selected: null, evaluations: [blocked] }, 'ORC').evaluations).toEqual([blocked])
  })
})

describe('read-only selector client', () => {
  it('only invokes dry-run with a single-project filter and refuses redirects', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ selected: row, evaluations: [row] }))
    const credentials = env()
    expect((await fetchPreview(config, credentials, request)).selected?.ticket_key).toBe('ORC-34')
    expect(request).toHaveBeenCalledTimes(1)
    const [url, options] = request.mock.calls[0]
    expect(url).toBe(`${config.url}/functions/v1/orchestrator-dry-run`)
    expect(options?.body).toBe(JSON.stringify({ project_key: 'ORC' }))
    expect(options?.redirect).toBe('error')
    expect(options?.signal).toBeInstanceOf(AbortSignal)
  })
  it.each([401, 403, 500])('reports HTTP %s without leaking error bodies or retrying', async status => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('secret-server-detail', { status }))
    await expect(fetchPreview(config, env(), request)).rejects.toThrow(String(status))
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('does not disclose transport errors containing credentials', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error('sensitive request dump'))
    await expect(fetchPreview(config, env(), request)).rejects.toThrow('could not be read')
  })
  it('reports malformed JSON without echoing content', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('secret invalid JSON'))
    await expect(fetchPreview(config, env(), request)).rejects.toThrow('could not be read')
  })
  it('aborts slow requests', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('timeout')), { once: true })
    }))
    await expect(fetchPreview(config, env(), request, 10)).rejects.toThrow('could not be read')
  })
  it('removes known credentials and terminal control codes from output', () => {
    expect(redact('\x1b[31msecret-token secret-key\x00', { FORGE_ACCESS_TOKEN: 'secret-token', FORGE_PUBLISHABLE_KEY: 'secret-key' })).toBe('[redacted] [redacted]')
  })
})
