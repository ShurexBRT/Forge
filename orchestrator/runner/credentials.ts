import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Config } from './preflight.ts'
import { PreflightError } from './preflight.ts'
import { runProcess } from './process.ts'

export type AgentRole = 'Builder' | 'QA'
function credentialPath(config: Config, role: AgentRole) {
  return join(config.repoPath, '.forge-runner', 'credentials', `${config.project}-${role}.json`)
}
async function protect(value: string, decrypt: boolean) {
  if (process.platform !== 'win32') throw new PreflightError('Encrypted local credentials currently require Windows. Use FORGE_AGENT_TOKEN on other platforms.')
  const operation = decrypt
    ? '[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($value), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))'
    : '[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($value), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))'
  const script = `$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.Security; $value = [Console]::In.ReadToEnd(); ${operation}`
  return runProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], process.cwd(), new AbortController().signal, value, 15_000)
}
export async function saveCredential(config: Config, role: AgentRole, token: string, credentialId: string) {
  const cipher = await protect(token, false)
  const path = credentialPath(config, role)
  await mkdir(join(config.repoPath, '.forge-runner', 'credentials'), { recursive: true, mode: 0o700 })
  await writeFile(path, JSON.stringify({ url: config.url, project: config.project, role, credentialId, cipher }, null, 2), { flag: 'wx', mode: 0o600 })
}
export async function loadCredential(config: Config, role: AgentRole): Promise<string | undefined> {
  let text: string
  try { text = await readFile(credentialPath(config, role), 'utf8') }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw new PreflightError('Local credential could not be read.') }
  try {
    const data = JSON.parse(text)
    if (data.url !== config.url || data.project !== config.project || data.role !== role || typeof data.cipher !== 'string') throw new Error()
    return await protect(data.cipher, true)
  } catch { throw new PreflightError('Local credential does not match this project or cannot be decrypted by this Windows account.') }
}
