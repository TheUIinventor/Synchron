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
      // Try a server-side userinfo probe using the access token so we can
      // embed the given name directly into the callback page. This avoids
      // client-side cookie-propagation races on first sign-in.
      let serverGivenName: string | null = null
      try {
        if (access) {
          try {
            const up = await fetch('https://student.sbhs.net.au/details/userinfo.json', { headers: { 'Authorization': `Bearer ${access}`, 'Accept': 'application/json' } })
            if (up && up.ok) {
              try {
                const uj = await up.json().catch(() => null)
                if (uj) {
                  if (uj.success && uj.data && uj.data.givenName) serverGivenName = uj.data.givenName
                  else if (uj.givenName) serverGivenName = uj.givenName
                  else if (uj.data && uj.data.student && (uj.data.student.givenName || uj.data.student.name)) serverGivenName = uj.data.student.givenName || uj.data.student.name
                  else if (uj.name) serverGivenName = uj.name
                }
              } catch (e) {}
            }
          } catch (e) {}
        }
      } catch (e) {}
  // Return a small HTML page that sets a localStorage flag to notify other
  // tabs that authentication completed, then redirect to the app home.
  const homeUrl = new URL('/', req.nextUrl.origin)
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script>
(async function(){
    try {
      // If we obtained a server-side name, write it immediately so the
      // app can show the user's name right after redirect.
      const serverName = ${serverGivenName ? JSON.stringify(serverGivenName) : 'null'}
      if (serverName) {
        try { localStorage.setItem('synchron-given-name', serverName) } catch (e) {}
      }
      // Retry a few times to robustly fetch profile while cookies propagate.
      let nameFound = null
      const statuses = []
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const resp = await fetch('/api/portal/userinfo', { credentials: 'include', cache: 'no-store' });
          statuses.push(resp ? resp.status : 0)
          if (resp && resp.ok) {
            try {
              const payload = await resp.json().catch(() => null);
              let name = null;
              if (payload) {
                if (payload.success && payload.data && payload.data.givenName) name = payload.data.givenName;
                else if (payload.givenName) name = payload.givenName;
                else if (payload.data && payload.data.student && (payload.data.student.givenName || payload.data.student.name)) name = payload.data.student.givenName || payload.data.student.name;
              }
              if (name) {
                nameFound = name
                try { localStorage.setItem('synchron-given-name', String(name)) } catch (e) {}
                break
              }
            } catch (e) {
              // ignore JSON parse errors
            }
          }
        } catch (e) {
          statuses.push(0)
        }
        // small delay before retrying
        try { await new Promise((r) => setTimeout(r, 300)) } catch (e) {}
      }
      try { localStorage.setItem('synchron-userinfo-status', JSON.stringify({ attempts: statuses })) } catch (e) {}
    } catch (e) {}
  try { localStorage.setItem('synchron-auth-updated', Date.now().toString()); } catch (e) {}
  window.location.replace('${homeUrl.toString()}');
})()
</script></body></html>`
  const res = new NextResponse(html, { status: 200 })
    res.headers.set('Content-Type', 'text/html; charset=utf-8')
    res.headers.set('Cache-Control', NON_SHARED_CACHE)
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
        maxAge: 60 * 60 * 24 * 30,
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
