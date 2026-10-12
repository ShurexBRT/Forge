import { spawn } from 'node:child_process'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { PreflightError } from './preflight.ts'

const execute = promisify(execFile)
export function workerEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowed = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMDATA', 'CODEX_HOME', 'LANG', 'LC_ALL'])
  return Object.fromEntries(Object.entries(env).filter(([key]) => allowed.has(key.toUpperCase())))
}

export async function runProcess(command: string, args: string[], cwd: string, signal: AbortSignal, input?: string, timeoutMs = 30 * 60_000): Promise<string> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: workerEnvironment(process.env), windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'], shell: false })
    let output = '', stopped = false, stopFailure = false
    let killing: Promise<void> = Promise.resolve()
    const stop = () => {
      if (stopped) return
      stopped = true
      killing = (async () => {
        if (!child.pid) return
        try {
          if (process.platform === 'win32') await execute('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
          else process.kill(-child.pid, 'SIGKILL')
        } catch {
          // Do not release ownership if termination cannot be confirmed.
          if (child.exitCode === null && child.signalCode === null) stopFailure = true
        }
      })()
    }
    const timeout = setTimeout(stop, timeoutMs)
    signal.addEventListener('abort', stop, { once: true })
    const clean = () => { clearTimeout(timeout); signal.removeEventListener('abort', stop) }
    // Keep bounded output for command results, never stream raw worker logs/secrets.
    child.stdout.on('data', chunk => { output = (output + chunk.toString()).slice(-1024 * 1024) })
    child.stderr.on('data', () => undefined)
    child.stdin.on('error', () => undefined)
    child.on('error', () => { clean(); reject(new PreflightError('Local process could not start. Check the configured executable.')) })
    child.on('close', async code => {
      clean(); await killing
      if (stopFailure || stopped || signal.aborted) reject(new PreflightError('Local process stopped or timed out; reconcile the execution before retrying.'))
      else if (code !== 0) reject(new PreflightError(`Local process failed (exit ${code ?? 'unknown'}). Review the worktree and verification results.`))
      else resolve(output.trim())
    })
    child.stdin.end(input)
    if (signal.aborted) stop()
  })
}
