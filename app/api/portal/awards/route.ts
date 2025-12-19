import { NextResponse, type NextRequest } from "next/server"

export const runtime = 'edge'
const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => { try { const hasCookie = req && req.cookies ? Boolean(req.cookies.get && (req.cookies.get('sbhs_access_token') || req.cookies.get('sbhs_refresh_token'))) : (req && req.headers && typeof req.headers.get === 'function' && Boolean(req.headers.get('cookie'))); return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE } } catch (e) { return { 'Cache-Control': SHARED_CACHE } } }

const PORTAL_AWARDS = "https://student.sbhs.net.au/awards"
const TOKEN_ENDPOINT = process.env.SBHS_TOKEN_ENDPOINT || 'https://auth.sbhs.net.au/token'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('sbhs_access_token')?.value || null

    try { console.debug('Proxy /api/portal/awards - token present:', !!token) } catch (e) {}

    if (!token) {
      return NextResponse.json({ success: false, error: 'No sbhs_access_token cookie present on this app domain. Please sign in via the app to enable portal access.' }, { status: 401, headers: cacheHeaders(req) })
    }

    const headers: Record<string, string> = {}
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
      headers["Accept"] = "application/json"
    }

    let res = await fetch(PORTAL_AWARDS, {
      method: "GET",
      headers,
    })

    // If portal returns 401 (token expired/invalid), try server-side refresh using refresh token and retry once
    if (res.status === 401) {
      const refreshToken = req.cookies.get('sbhs_refresh_token')?.value || null
      try { console.debug('Proxy /api/portal/awards - portal returned 401, attempting refresh, refresh present:', !!refreshToken) } catch (e) {}
      if (refreshToken) {
        const params = new URLSearchParams()
        params.append('grant_type', 'refresh_token')
        params.append('refresh_token', refreshToken)
        params.append('client_id', process.env.SBHS_APP_ID || '')
        params.append('client_secret', process.env.SBHS_APP_SECRET || '')

        const tokenRes = await fetch(TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        })

        if (tokenRes.ok) {
          const tok = await tokenRes.json()
          const newAccess = tok.access_token
          const newRefresh = tok.refresh_token
          const expiresIn = tok.expires_in || 3600

          headers['Authorization'] = `Bearer ${newAccess}`
          res = await fetch(PORTAL_AWARDS, { method: 'GET', headers })

          const contentType = res.headers.get('content-type') || 'text/plain'
          const text = await res.text()
          const nextRes = new NextResponse(text, { status: res.status, headers: Object.assign({}, { 'content-type': contentType }, cacheHeaders(req)) })
          nextRes.cookies.set('sbhs_access_token', newAccess, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'lax',
            maxAge: expiresIn,
            path: '/',
          })
          if (newRefresh) {
            nextRes.cookies.set('sbhs_refresh_token', newRefresh, {
              httpOnly: true,
              secure: process.env.NODE_ENV !== 'development',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 30,
              path: '/',
            })
          }
          return nextRes
        }
      }
    }

    const contentType = res.headers.get("content-type") || "text/plain"
    const text = await res.text()

    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(text)
        return NextResponse.json(json, { status: res.status, headers: cacheHeaders(req) })
      } catch (e) {
        return new Response(text, { status: res.status, headers: Object.assign({}, { "content-type": contentType }, cacheHeaders(req)) })
      }
    }

    return new Response(text, { status: res.status, headers: Object.assign({}, { "content-type": contentType }, cacheHeaders(req)) })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Proxy error" }, { status: 500, headers: cacheHeaders(req) })
  }
}
