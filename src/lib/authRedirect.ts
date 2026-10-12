export const FORGE_PRODUCTION_URL = 'https://shurexbrt.github.io/Forge/'

export type AuthRedirectFlow = 'confirmation' | 'recovery'

/**
 * Supabase redirects must be explicit and must match Authentication > URL Configuration.
 * GitHub Pages serves Forge under /Forge/, not the hostname root.
 */
export function buildAuthRedirectUrl(
  production: boolean,
  baseUrl: string,
  currentHref: string,
  flow: AuthRedirectFlow = 'confirmation',
): string {
  const url = new URL(production ? FORGE_PRODUCTION_URL : baseUrl, currentHref)
  // Do not forward an existing access token / error hash from the current page.
  url.hash = ''
  url.search = ''

  if (flow === 'recovery') url.searchParams.set('auth', 'recovery')
  return url.href
}

export function isPasswordRecoveryCallback(search: string, hash: string): boolean {
  const query = new URLSearchParams(search.replace(/^\?/, ''))
  const fragment = new URLSearchParams(hash.replace(/^#/, ''))
  return query.get('auth') === 'recovery' || fragment.get('type') === 'recovery'
}

export function passwordRecoveryCallbackError(hash: string): string | null {
  const fragment = new URLSearchParams(hash.replace(/^#/, ''))
  if (!fragment.get('error')) return null
  return fragment.get('error_description') || 'This password reset link is invalid or has expired.'
}
