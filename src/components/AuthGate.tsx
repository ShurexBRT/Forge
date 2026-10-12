import type { User } from '@supabase/supabase-js'
import { Cloud, Hammer } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { buildAuthRedirectUrl, isPasswordRecoveryCallback, passwordRecoveryCallbackError, type AuthRedirectFlow } from '../lib/authRedirect'

interface AuthGateRenderState {
  user: User | null
  signOut: () => Promise<void>
}

interface AuthGateProps {
  children: (state: AuthGateRenderState) => ReactNode
}

type AuthMode = 'signin' | 'signup' | 'forgot' | 'recovery'

function getAuthRedirectUrl(flow: AuthRedirectFlow = 'confirmation') {
  return buildAuthRedirectUrl(import.meta.env.PROD, import.meta.env.BASE_URL, window.location.href, flow)
}

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)

      // Some browsers process a recovery link before PASSWORD_RECOVERY is emitted.
      // The URL marker makes the reset form resilient to that event ordering.
      if (isPasswordRecoveryCallback(window.location.search, window.location.hash)) {
        if (data.session?.user) {
          setMode('recovery')
          setError(null)
        } else {
          setMode('forgot')
          setError(
            passwordRecoveryCallbackError(window.location.hash)
            ?? sessionError?.message
            ?? 'This recovery link has expired or is invalid. Request a new one.',
          )
        }
      }
      setLoading(false)
    }).catch(() => {
      if (!mounted) return
      setMode('forgot')
      setError('Unable to verify your recovery link. Please try again.')
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('recovery')
        setPassword('')
        setConfirmPassword('')
        setError(null)
        setMessage('Choose a new password for your Forge account.')
      }

      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function submit() {
    if (!supabase) return

    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'forgot') {
        if (!email.trim()) return
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: getAuthRedirectUrl('recovery'),
        })
        if (resetError) throw resetError
        setMessage('Password reset email sent. Open the link in the email to choose a new password.')
        return
      }

      if (mode === 'recovery') {
        if (!password) return
        if (password.length < 8) throw new Error('Password must be at least 8 characters.')
        if (password !== confirmPassword) throw new Error('Passwords do not match.')

        const { error: updateError } = await supabase.auth.updateUser({ password })
        if (updateError) throw updateError

        // End the short-lived recovery session and ask for a normal password login.
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) throw signOutError
        window.history.replaceState(window.history.state, '', window.location.pathname)
        setPassword('')
        setConfirmPassword('')
        setMode('signin')
        setMessage('Password updated successfully. Sign in using your new password.')
        return
      }

      if (!email.trim() || !password) return

      if (mode === 'signin') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (authError) throw authError
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
          },
        })
        if (authError) throw authError
        if (!data.session) setMessage('Account created. Check your email to confirm the account, then sign in.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  if (!isSupabaseConfigured) return <>{children({ user: null, signOut })}</>

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-loading"><Hammer size={24} /> Connecting Forge…</div>
      </div>
    )
  }

  if (mode === 'recovery') {
    return (
      <div className="auth-shell">
        <form
          className="auth-card"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="auth-brand"><div className="brand-mark">F</div><div><strong>Forge</strong><span>agent desk</span></div></div>
          <div className="auth-cloud"><Cloud size={14} /> Password recovery</div>
          <h1>Choose a new password</h1>
          <p>Set a new password for your Forge account.</p>

          <label>New password<input type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <label>Confirm password<input type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-message">{message}</div>}

          <button className="primary-button auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <form
          className="auth-card"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="auth-brand"><div className="brand-mark">F</div><div><strong>Forge</strong><span>agent desk</span></div></div>
          <div className="auth-cloud"><Cloud size={14} /> Cloud workspace</div>
          <h1>{mode === 'signin' ? 'Sign in to Forge' : mode === 'signup' ? 'Create your Forge account' : 'Reset your password'}</h1>
          <p>
            {mode === 'forgot'
              ? 'Enter your email and Forge will send you a recovery link.'
              : 'Your tickets and agent runs are protected by Supabase Auth and row-level security.'}
          </p>

          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          {mode !== 'forgot' && (
            <label>Password<input type="password" minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          )}

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-message">{message}</div>}

          <button className="primary-button auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Working…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>

          {mode === 'signin' && (
            <button
              className="auth-switch"
              type="button"
              onClick={() => {
                setMode('forgot')
                setError(null)
                setMessage(null)
                setPassword('')
              }}
            >
              Forgot password?
            </button>
          )}

          <button
            className="auth-switch"
            type="button"
            onClick={() => {
              setMode((current) => current === 'signup' ? 'signin' : current === 'signin' ? 'signup' : 'signin')
              setError(null)
              setMessage(null)
              setPassword('')
            }}
          >
            {mode === 'signin' ? 'Need an account? Create one' : mode === 'signup' ? 'Already have an account? Sign in' : 'Back to sign in'}
          </button>
        </form>
      </div>
    )
  }

  return <>{children({ user, signOut })}</>
}
