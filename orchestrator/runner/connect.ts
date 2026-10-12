import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import type { ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { fetchPreview, PreflightError } from './preflight.ts'
import type { Config, Preview } from './preflight.ts'

export const forgePublishableKey = 'sb_publishable_iZ_vk9CS_5A6GzKwBf1O9Q_B5pwRKJM'
type Credentials = { email: string; password: string }
type Authenticate = (credentials: Credentials) => Promise<Preview>

export function createAuthenticator(config: Config, env: NodeJS.ProcessEnv): Authenticate {
  const key = env.FORGE_PUBLISHABLE_KEY || (config.url === 'https://yljhffprkprbgjdaarqi.supabase.co' ? forgePublishableKey : '')
  if (!/^sb_publishable_[\w-]+$/.test(key)) throw new PreflightError('Configure a publishable key for this project before connecting.')
  return async credentials => {
    const client = createClient(config.url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) }) },
    })
    try {
      const { data, error } = await client.auth.signInWithPassword(credentials)
      if (error || !data.session) throw new PreflightError('Prijava nije uspela. Proveri email i lozinku; za ovaj pregled je potreban Forge admin nalog.')
      return await fetchPreview(config, { FORGE_ACCESS_TOKEN: data.session.access_token, FORGE_PUBLISHABLE_KEY: key })
    } finally {
      // Only revoke the session created here, never the user's existing browser sessions.
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined)
    }
  }
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}
function page(content: string): string {
  return `<!doctype html><html lang="sr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forge · Poveži runner</title><style>body{font:16px/1.6 system-ui;background:#101416;color:#e6eee9;margin:0}main{max-width:760px;margin:7vh auto;padding:32px}h1{font-size:32px;line-height:1.2}p{color:#b5c6bd}label{display:block;margin:20px 0 6px}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #46534b;border-radius:8px;background:#1a2320;color:white;font:inherit}button{background:#b2f4ca;color:#112719;font:600 16px system-ui;padding:13px 22px;border:0;border-radius:8px;margin-top:24px;cursor:pointer}article{border-top:1px solid #46534b;padding:18px 0}small{color:#a0bcab}.error{color:#ffb0a5}code{overflow-wrap:anywhere}</style><main>${content}</main></html>`
}
function form(nonce: string, config: Config, error = '') {
  return page(`<small>FORGE / LOKALNI RUNNER</small><h1>Poveži Forge nalog</h1><p>Prijavi se da prikažemo tikete projekta <strong>${escape(config.project)}</strong>. Ovaj korak ne pokreće agente niti menja tikete.</p><p>Prijava ide ka <code>${escape(config.url)}</code>. Lozinka i tokeni se ne čuvaju na disku. Sesija važi samo za ovaj pregled.</p>${error ? `<p class="error" role="alert">${escape(error)}</p>` : ''}<form action="/login" method="post"><input type="hidden" name="nonce" value="${nonce}"><label for="email">Forge email</label><input id="email" name="email" type="email" autocomplete="username" required><label for="password">Lozinka</label><input id="password" name="password" type="password" autocomplete="current-password" required><button type="submit">Prijavi se i prikaži tikete</button></form>`)
}
function resultPage(preview: Preview) {
  return page(`<small>FORGE / PREGLED BEZ IZMENA</small><h1>Povezivanje uspešno</h1><p>Predloženi tiket: <strong>${escape(preview.selected?.ticket_key ?? 'nema dostupnog tiketa')}</strong>. Automatsko izvršavanje je isključeno.</p>${preview.evaluations.map(row => `<article><small>${row.eligible ? 'DOSTUPAN' : 'BLOKIRAN'} · ${escape(row.required_role ?? 'bez uloge')}</small><h2>${escape(row.ticket_key)} · ${escape(row.title)}</h2>${[...row.blockers, ...row.warnings].map(reason => `<p>${escape(reason)}</p>`).join('')}</article>`).join('')}<p>Sesija runnera je završena. Ovaj tab možeš zatvoriti.</p>`)
}

export async function startConnect(config: Config, authenticate: Authenticate, options: { timeoutMs?: number; onRejected?: (reason: string) => void } = {}) {
  const nonce = randomBytes(32).toString('hex')
  let origin = '', busy = false, finished = false
  let settle!: (value: Preview | null) => void
  const done = new Promise<Preview | null>(resolve => { settle = resolve })
  function reply(res: ServerResponse, status: number, html: string) {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' })
    res.end(html)
  }
  const server = createServer(async (req, res) => {
    if (req.headers.host !== new URL(origin).host) {
      options.onRejected?.('Unexpected Host header')
      reply(res, 403, page('Zahtev nije dozvoljen.')); return
    }
    if (req.method === 'GET' && req.url === '/') { reply(res, 200, form(nonce, config)); return }
    if (req.method !== 'POST' || req.url !== '/login') { reply(res, 404, page('Stranica ne postoji.')); return }
    // Top-level GET navigation from another page is valid. Only form submissions
    // must originate from this exact loopback origin and carry our nonce.
    if (req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')
      || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) {
      options.onRejected?.(req.headers.origin !== origin ? 'Form origin is missing or does not match' : 'Unexpected form content type or fetch site')
      reply(res, 403, page('Zahtev nije dozvoljen.')); return
    }
    if (busy || finished) { reply(res, 409, page('Prijava je već u toku ili završena.')); return }
    busy = true
    try {
      let body = ''
      for await (const chunk of req) {
        body += chunk.toString()
        if (Buffer.byteLength(body) > 16_384) { reply(res, 413, page('Zahtev je prevelik.')); return }
      }
      const fields = new URLSearchParams(body)
      if (fields.get('nonce') !== nonce) { reply(res, 403, page('Zahtev nije dozvoljen.')); return }
      const email = fields.get('email')?.trim(), password = fields.get('password')
      if (!email || !password || email.length > 320 || password.length > 4096) { reply(res, 400, form(nonce, config, 'Unesi email i lozinku.')); return }
      const preview = await authenticate({ email, password })
      if (finished) { res.destroy(); return }
      reply(res, 200, resultPage(preview))
      finish(preview)
    } catch {
      if (!finished && !res.destroyed) reply(res, 400, form(nonce, config, 'Prijava ili čitanje tiketa nije uspelo. Proveri Forge admin nalog i vezu, pa pokušaj ponovo.'))
    } finally { busy = false }
  })
  server.requestTimeout = 20_000
  server.headersTimeout = 10_000
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new PreflightError('Local login server could not start.')
  origin = `http://127.0.0.1:${address.port}`
  const timer = setTimeout(() => finish(null), options.timeoutMs ?? 15 * 60_000)
  function finish(value: Preview | null) {
    if (finished) return
    finished = true
    clearTimeout(timer)
    server.close()
    // Finish responses already written; terminate incomplete requests on timeout/cancel.
    if (value === null) server.closeAllConnections()
    settle(value)
  }
  return { url: origin, done, close: () => finish(null) }
}
