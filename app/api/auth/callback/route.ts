import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'

const clientId = process.env.SBHS_APP_ID || process.env.SBHS_CLIENT_ID || ''
const clientSecret = process.env.SBHS_APP_SECRET || process.env.SBHS_CLIENT_SECRET || ''
const redirectUri = process.env.SBHS_REDIRECT_URI || process.env.NEXT_PUBLIC_SBHS_REDIRECT_URI_VERCEL || ''
const TOKEN_ENDPOINT = process.env.SBHS_TOKEN_ENDPOINT || 'https://auth.sbhs.net.au/token'

// Exchange authorization code for access/refresh tokens
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const savedState = req.cookies.get('sbhs_oauth_state')?.value

  if (!code) {
    // If we got here without a code, bounce back to login to restart the flow (avoids blank JSON error page)
    return NextResponse.redirect('/api/auth/login')
  }
  if (savedState && state && state !== savedState) return NextResponse.json({ error: 'Invalid state' }, { status: 400 })

  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', code)
  // Use configured redirect URI or fall back to current origin + /auth/callback to exactly match the authorize step
  const effectiveRedirect = redirectUri || `${req.nextUrl.origin}/auth/callback`
  body.set('redirect_uri', effectiveRedirect)
  body.set('client_id', clientId)
  body.set('client_secret', clientSecret)

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const text = await response.text()
    let data: any
    try { data = JSON.parse(text) } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON from token endpoint', responseBody: text }, { status: 500 })
    }
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch tokens', details: data }, { status: response.status })
    }

    const access = data.access_token
    const refresh = data.refresh_token
    const expiresIn = data.expires_in || 3600
    
    // Redirect back to app home with auth success flag
    const homeUrl = new URL('/', req.nextUrl.origin)
    homeUrl.searchParams.set('auth_success', 'true')
    const res = NextResponse.redirect(homeUrl.toString())
    
    // Trigger bootstrap endpoint immediately in background to pre-fetch data
    // This ensures userinfo, timetable, notices, awards, etc. are available when user lands on home page
    try {
      const bootstrapUrl = new URL('/api/bootstrap', req.nextUrl.origin)
      // Fire and forget - don't wait for bootstrap to complete
      fetch(bootstrapUrl.toString(), {
        headers: {
          'Cookie': `sbhs_access_token=${access}`,
        },
      }).catch(err => console.error('[auth/callback] Bootstrap fetch failed:', err))
    } catch (err) {
      console.error('[auth/callback] Error triggering bootstrap:', err)
    }
    res.cookies.set('sbhs_access_token', access, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
      maxAge: Number(expiresIn),
    })
    if (refresh) {
      res.cookies.set('sbhs_refresh_token', refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 90, // Extended from 30 to 90 days for longer session retention
      })
    }
    // Clear state cookie
    res.cookies.set('sbhs_oauth_state', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV !== 'development', path: '/', maxAge: 0 })
    // Auth callbacks must not be public-cached
    res.headers.set('Cache-Control', NON_SHARED_CACHE)
    return res
  } catch (error) {
    return NextResponse.json({ error: 'Token exchange error', details: String(error) }, { status: 500, headers: { 'Cache-Control': NON_SHARED_CACHE } })
  }
}
