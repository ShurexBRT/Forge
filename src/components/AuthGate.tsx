import type { User } from '@supabase/supabase-js'
import { Cloud, Hammer } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

interface AuthGateRenderState {
  user: User | null
  signOut: () => Promise<void>
}

interface AuthGateProps {
  children: (state: AuthGateRenderState) => ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function submit() {
    if (!supabase || !email.trim() || !password) return

    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
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
          <h1>{mode === 'signin' ? 'Sign in to Forge' : 'Create your Forge account'}</h1>
          <p>Your tickets and agent runs are protected by Supabase Auth and row-level security.</p>

          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-message">{message}</div>}

          <button className="primary-button auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
          <button
            className="auth-switch"
            type="button"
            onClick={() => {
              setMode((current) => current === 'signin' ? 'signup' : 'signin')
              setError(null)
              setMessage(null)
            }}
          >
            {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    )
  }

  return <>{children({ user, signOut })}</>
}
