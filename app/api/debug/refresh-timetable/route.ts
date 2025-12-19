import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => { try { const hasCookie = req && req.headers && typeof req.headers.get === 'function' && Boolean(req.headers.get('cookie')); return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE } } catch (e) { return { 'Cache-Control': SHARED_CACHE } } }

function mask(v: string | null | undefined) {
  if (!v) return null
  if (v.length <= 8) return v.replace(/./g, '*')
  return `${v.slice(0,4)}…${v.slice(-4)}`
}

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl?.origin || `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}`
    const cookieHeader = req.headers.get('cookie') || ''

    // 1) Call auth refresh and capture set-cookie header
    let refreshResult: any = { ok: false }
    try {
      const r = await fetch(`${origin}/api/auth/refresh`, { headers: { Cookie: cookieHeader }, redirect: 'manual' })
      const text = await r.text().catch(() => '')
      refreshResult = { status: r.status, ok: r.ok, body: (() => {
        try { return JSON.parse(text) } catch { return text }
      })(), setCookie: r.headers.get('set-cookie') ?? null }
    } catch (e) {
      refreshResult = { ok: false, error: String(e) }
    }

    // Build cookie header for timetable call: include incoming cookies plus any new set-cookie from refresh
    let combinedCookie = cookieHeader
    if (refreshResult.setCookie) {
      // take only name=value parts from set-cookie(s)
      try {
        const parts = (refreshResult.setCookie as string).split(/,(?=[^ ;]+=)/g).map((s: string) => s.trim())
        const nv = parts.map((p: string) => p.split(/;\s*/)[0]).filter(Boolean).join('; ')
        if (nv) {
          combinedCookie = [combinedCookie, nv].filter(Boolean).join('; ')
        }
      } catch (e) {
        // ignore parsing errors
      }
    }

    // 2) Call timetable with combined cookie header
    let timetableResult: any = { ok: false }
    try {
      const rt = await fetch(`${origin}/api/timetable`, { headers: { Cookie: combinedCookie }, redirect: 'manual' })
      const ctype = rt.headers.get('content-type') || ''
      let body: any = null
      try {
        const t = await rt.text()
        body = ctype.includes('application/json') ? JSON.parse(t) : t
      } catch (e) {
        body = null
      }
      timetableResult = { status: rt.status, ok: rt.ok, contentType: ctype, body, setCookie: rt.headers.get('set-cookie') ?? null }
    } catch (e) {
      timetableResult = { ok: false, error: String(e) }
    }

    // 3) Return diagnostics (mask sensitive values)
    const resp = {
      ok: true,
      incomingCookies: Object.fromEntries((cookieHeader || '').split(';').map(s => s.trim()).filter(Boolean).map(p => {
        const idx = p.indexOf('=')
        return idx === -1 ? [p, null] : [p.slice(0, idx), mask(p.slice(idx+1))]
      })),
      refreshResult: {
        status: refreshResult.status ?? null,
        ok: !!refreshResult.ok,
        body: refreshResult.body ?? refreshResult.error ?? null,
        setCookie: refreshResult.setCookie ? String(refreshResult.setCookie).split(',').map(s => s.split(/;\s*/)[0]) : null,
      },
      timetableResult: {
        status: timetableResult.status ?? null,
        ok: !!timetableResult.ok,
        contentType: timetableResult.contentType ?? null,
        body: timetableResult.body ?? null,
        setCookie: timetableResult.setCookie ? String(timetableResult.setCookie).split(',').map(s => s.split(/;\s*/)[0]) : null,
      },
    }

    return NextResponse.json(resp, { headers: cacheHeaders(req) })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500, headers: cacheHeaders(req) })
  }
}
