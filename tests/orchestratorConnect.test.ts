import { afterEach, describe, expect, it, vi } from 'vitest'
import { get } from 'node:http'
import { readConfig } from '../orchestrator/runner/preflight'
import { startConnect } from '../orchestrator/runner/connect'

const config = readConfig({}, process.cwd())
const cleanups: Array<() => void> = []
afterEach(() => { cleanups.splice(0).forEach(close => close()) })
async function start(authenticate = vi.fn().mockResolvedValue({ selected: null, evaluations: [] }), timeoutMs = 5000) {
  const connection = await startConnect(config, authenticate, { timeoutMs })
  cleanups.push(connection.close)
  const page = await fetch(connection.url)
  const html = await page.text()
  const nonce = /name="nonce" value="([a-f0-9]+)"/.exec(html)![1]
  const submit = (overrides: Record<string, string> = {}, headers: Record<string, string> = {}) => fetch(`${connection.url}/login`, {
    method: 'POST', headers: { Origin: connection.url, ...headers },
    body: new URLSearchParams({ nonce, email: 'test@example.com', password: 'test-password', ...overrides }),
  })
  return { ...connection, authenticate, submit, page, html }
}

describe('local login boundary (real HTTP)', () => {
  it('serves a no-store, script-free login form and binds only loopback', async () => {
    const app = await start()
    expect(app.url).toMatch(/^http:\/\/127\.0\.0\.1:/)
    expect(app.page.headers.get('cache-control')).toBe('no-store')
    expect(app.page.headers.get('referrer-policy')).toBe('same-origin')
    expect(app.page.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(app.html).toContain('type="password"')
    expect(app.authenticate).not.toHaveBeenCalled()
    expect((await fetch(app.url, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(200)
  })
  it('blocks cross-origin submissions and invalid nonce before authentication', async () => {
    const app = await start()
    expect((await app.submit({}, { Origin: 'https://evil.example' })).status).toBe(403)
    expect((await app.submit({ nonce: 'wrong' })).status).toBe(403)
    expect((await app.submit({}, { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403)
    expect(app.authenticate).not.toHaveBeenCalled()
  })
  it('rejects forged Host headers and unknown mutation endpoints', async () => {
    const app = await start()
    // Native fetch rewrites Host, so use the raw HTTP client for this boundary test.
    const status = await new Promise<number | undefined>((resolve, reject) => {
      get(app.url, { headers: { Host: 'evil.example' } }, response => {
        response.resume()
        resolve(response.statusCode)
      }).on('error', reject)
    })
    expect(status).toBe(403)
    expect((await fetch(`${app.url}/dispatch`, { method: 'POST' })).status).toBe(404)
  })
  it('authenticates once, displays escaped results and closes the listener', async () => {
    const row = { ticket_key: 'ORC-34', project_key: 'ORC', title: '<script>bad()</script>', required_role: 'Builder', eligible: true, blockers: [], warnings: [] }
    const preview = { selected: row, evaluations: [row] }
    const app = await start(vi.fn().mockResolvedValue(preview))
    const response = await app.submit()
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('test-password')
    expect(await app.done).toEqual(preview)
    expect(app.authenticate).toHaveBeenCalledTimes(1)
  })
  it('never echoes authentication exceptions or submitted credentials', async () => {
    const app = await start(vi.fn().mockRejectedValue(new Error('test-password bearer-secret')))
    const response = await app.submit()
    expect(response.status).toBe(400)
    const html = await response.text()
    expect(html).not.toContain('test-password')
    expect(html).not.toContain('bearer-secret')
  })
  it('rejects a second submission while the first authentication is pending', async () => {
    let finish!: (value: { selected: null; evaluations: [] }) => void
    const app = await start(vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve })))
    const first = app.submit()
    await vi.waitFor(() => expect(app.authenticate).toHaveBeenCalledTimes(1))
    expect((await app.submit()).status).toBe(409)
    finish({ selected: null, evaluations: [] })
    expect((await first).status).toBe(200)
    expect(app.authenticate).toHaveBeenCalledTimes(1)
  })
  it('rejects non-form submissions and empty credentials without authentication', async () => {
    const app = await start()
    expect((await app.submit({}, { 'Content-Type': 'application/json' })).status).toBe(403)
    expect((await app.submit({ password: '' })).status).toBe(400)
    expect(app.authenticate).not.toHaveBeenCalled()
  })
  it('cancels without authenticating', async () => {
    const app = await start()
    app.close()
    expect(await app.done).toBeNull()
    expect(app.authenticate).not.toHaveBeenCalled()
  })
  it('expires without keeping an idle server open', async () => {
    const app = await start(undefined, 100)
    expect(await app.done).toBeNull()
  })
})
