import { NextRequest, NextResponse } from 'next/server';

const clientId = process.env.SBHS_APP_ID || process.env.SBHS_CLIENT_ID || ''
const redirectUri = process.env.SBHS_REDIRECT_URI || process.env.NEXT_PUBLIC_SBHS_REDIRECT_URI_VERCEL || ''
const AUTH_ENDPOINT = process.env.SBHS_AUTHORIZATION_ENDPOINT || 'https://auth.sbhs.net.au/authorize'

// Redirect the user to SBHS OAuth authorization
export async function GET(req: NextRequest) {
  const state = Math.random().toString(36).slice(2)
  const url = new URL(AUTH_ENDPOINT)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  if (redirectUri) url.searchParams.set('redirect_uri', redirectUri)
  // request refresh capability if supported; harmless if ignored by provider
  url.searchParams.set('scope', 'read')
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url.toString())
  res.cookies.set('sbhs_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV !== 'development', path: '/' })
  return res
}
