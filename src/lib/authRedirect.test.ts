import { describe, expect, it } from 'vitest'
import {
  buildAuthRedirectUrl,
  FORGE_PRODUCTION_URL,
  isPasswordRecoveryCallback,
  passwordRecoveryCallbackError,
} from './authRedirect'

describe('Forge Supabase auth redirects', () => {
  it('uses the exact live GitHub Pages URL for production confirmations', () => {
    expect(buildAuthRedirectUrl(true, './', 'https://shurexbrt.github.io/Forge/', 'confirmation'))
      .toBe(FORGE_PRODUCTION_URL)
  })

  it('sends production password recovery to Forge instead of localhost', () => {
    expect(buildAuthRedirectUrl(true, './', 'http://localhost:3000/#access_token=secret', 'recovery'))
      .toBe('https://shurexbrt.github.io/Forge/?auth=recovery')
  })

  it('uses a local redirect only when running a development build', () => {
    expect(buildAuthRedirectUrl(false, './', 'http://localhost:5173/Forge/', 'recovery'))
      .toBe('http://localhost:5173/Forge/?auth=recovery')
  })

  it('recognizes recovery links from query or Supabase hash', () => {
    expect(isPasswordRecoveryCallback('?auth=recovery', '')).toBe(true)
    expect(isPasswordRecoveryCallback('', '#type=recovery&access_token=abc')).toBe(true)
    expect(isPasswordRecoveryCallback('', '#type=signup')).toBe(false)
  })

  it('surfaces expired-link errors without exposing tokens', () => {
    expect(passwordRecoveryCallbackError('#error=access_denied&error_description=Email+link+is+invalid'))
      .toBe('Email link is invalid')
    expect(passwordRecoveryCallbackError('#access_token=secret&type=recovery')).toBe(null)
  })
})
