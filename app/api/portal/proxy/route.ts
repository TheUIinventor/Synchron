import { NextResponse } from 'next/server'

export const runtime = 'edge'
const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => {
  try { const hasCookie = req && req.headers && typeof req.headers.get === 'function' && Boolean(req.headers.get('cookie')); return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE } } catch (e) { return { 'Cache-Control': SHARED_CACHE } }
}

// Whitelist a small set of safe portal paths we allow probing via this diagnostic proxy.
const ALLOWED = new Set([
  '/details/userinfo.json',
  '/notices',
  '/awards',
  '/timetable',
])

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const p = url.searchParams.get('path')
    if (!p) return NextResponse.json({ ok: false, error: 'Missing path query param' }, { status: 400 })

    // normalize leading slash
    const normalized = p.startsWith('/') ? p : `/${p}`
    if (!ALLOWED.has(normalized)) return NextResponse.json({ ok: false, error: 'Path not allowed' }, { status: 403 })

    const apiUrl = `https://student.sbhs.net.au${normalized}`

    // forward sbhs cookies if present
    // We read raw cookie header and forward it to the portal
    const rawCookie = req.headers.get('cookie') || ''

    const headers: Record<string,string> = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://student.sbhs.net.au/',
    }
    if (rawCookie) headers['Cookie'] = rawCookie

    const res = await fetch(apiUrl, { headers })
    const text = await res.text()

    // capture key response headers
    const resp: any = { ok: res.ok, status: res.status, url: apiUrl }
    const ct = res.headers.get('content-type')
    if (ct) resp['content-type'] = ct
    const sc = res.headers.get('set-cookie')
    if (sc) resp['set-cookie'] = sc

    // Try parse JSON if content-type says so
    if (ct && ct.includes('application/json')) {
      try {
        resp.payload = JSON.parse(text)
      } catch (e) {
        resp.payload = { parseError: String(e), text }
      }
    } else {
      resp.text = text.slice(0, 4096)
    }

    const options: any = { status: 200 }
    options.headers = Object.assign({}, cacheHeaders(req))
    if (sc) {
      // forward Set-Cookie to the client but strip Domain
      const forwarded = sc.replace(/;\s*Domain=[^;]+/gi, '')
      options.headers['set-cookie'] = forwarded
    }

    return NextResponse.json(resp, options)
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500, headers: cacheHeaders(req) })
  }
}
