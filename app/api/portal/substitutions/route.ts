import { NextResponse } from 'next/server'
import { normalizeVariation, collectFromJson } from '@/lib/api/normalizers'

const PORTAL_BASE = 'https://student.sbhs.net.au'
const API_BASE = 'https://api.sbhs.net.au'
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const forceApi = (url.searchParams.get('source') || url.searchParams.get('force') || '').toLowerCase() === 'api'
    const wantDebugRaw = String(url.searchParams.get('debug') || '').toLowerCase() === '1' || String(url.searchParams.get('debug') || '').toLowerCase() === 'true'
    const rawCookie = req.headers.get('cookie') || ''
    // If the app has a stored sbhs_access_token (set by our auth callback), forward it as a Bearer token.
    // This is necessary because browser cookies for student.sbhs.net.au are not available to the server proxy.
    const accessToken = (() => {
      try {
        // Next.js Request in Edge/Route handler doesn't expose cookies via req.cookies, so parse header as fallback
        const m = rawCookie.match(/(?:^|; )sbhs_access_token=([^;]+)/)
        return m ? decodeURIComponent(m[1]) : undefined
      } catch { return undefined }
    })()

    const headers: Record<string, string> = {
      'Accept': 'application/json, text/html;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Synchron/1.0; +https://example.com)'
    }
    if (rawCookie) headers['Cookie'] = rawCookie
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

    // Try API host first when we have a bearer token or the caller requested the API explicitly.
    // (Some environments may accept unauthenticated API reads; requesters can force API via ?source=api.)
    const jsonPaths = ['/api/timetable/timetable.json', '/api/timetable/daytimetable.json']
    if (accessToken || forceApi) {
      try {
        // Fire both API JSON endpoint requests in parallel and pick the first valid JSON response.
        const reqs = jsonPaths.map(p => fetch(`${API_BASE}${p}`, { headers, redirect: 'follow' }))
        const settled = await Promise.allSettled(reqs)
        for (let i = 0; i < settled.length; i++) {
          const s = settled[i]
          const p = jsonPaths[i]
          if (s.status === 'fulfilled') {
            try {
              const res = s.value as Response
              const ct = res.headers.get('content-type') || ''
              if (res.ok && ct.includes('application/json')) {
                const j = await res.json().catch(() => null)
                if (j) {
                  const subs = collectFromJson(j)
                  const payload: any = { substitutions: subs, source: `${API_BASE}${p}`, lastUpdated: new Date().toISOString() }
                  if (wantDebugRaw) payload.raw = j
                  return NextResponse.json(payload)
                }
              }
            } catch (e) {
              // ignore parsing errors for this candidate and continue
            }
          }
        }
      } catch (e) {
        // ignore and fall back to portal
      }
    }

    // Try portal JSON endpoints next (may require session cookie)
    const endpoints = ['/timetable/timetable.json', '/timetable/daytimetable.json']
    try {
      // Try portal JSON endpoints in parallel and return the first valid JSON response.
      const reqs = endpoints.map(ep => fetch(`${PORTAL_BASE}${ep}`, { headers, redirect: 'follow' }))
      const settled = await Promise.allSettled(reqs)
      for (let i = 0; i < settled.length; i++) {
        const s = settled[i]
        const ep = endpoints[i]
        if (s.status === 'fulfilled') {
          try {
            const res = s.value as Response
            const ct = res.headers.get('content-type') || ''
            if (res.ok && ct.includes('application/json')) {
              const j = await res.json().catch(() => null)
              if (j) {
                const subs = collectFromJson(j)
                const payload: any = { substitutions: subs, source: `${PORTAL_BASE}${ep}`, lastUpdated: new Date().toISOString() }
                if (wantDebugRaw) payload.raw = j
                return NextResponse.json(payload)
              }
            }
          } catch (e) {
            // ignore parse errors for this candidate
          }
        }
      }
    } catch (e) {
      // ignore and fall back to empty response below
    }

    // If JSON endpoints not available, return empty array
    // The client-side code should fetch and parse HTML if needed
    return NextResponse.json({ 
      substitutions: [], 
      source: `${PORTAL_BASE} (no JSON endpoint available)`,
      lastUpdated: new Date().toISOString(),
      fallbackNeeded: true
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
