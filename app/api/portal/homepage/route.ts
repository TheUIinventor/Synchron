import { NextResponse } from 'next/server'

export const runtime = 'edge'
const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => {
  try { const hasCookie = req && req.headers && typeof req.headers.get === 'function' && Boolean(req.headers.get('cookie')); return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE } } catch (e) { return { 'Cache-Control': SHARED_CACHE } }
}

// Fetches the SBHS portal homepage, forwarding cookies from the browser, and returns the HTML.
// This relies on the user's active portal session in the same browser to succeed.
export async function GET(req: Request) {
  try {
    const rawCookie = req.headers.get('cookie') || ''
    const headers: Record<string, string> = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Referer': 'https://student.sbhs.net.au/',
    }
    if (rawCookie) headers['Cookie'] = rawCookie

    const res = await fetch('https://student.sbhs.net.au/', { headers, redirect: 'follow' })
    const text = await res.text()

    // If we got redirected to a login page, we'll still forward the HTML so the client can react.
    const ct = res.headers.get('content-type') || 'text/html; charset=utf-8'
    const sc = res.headers.get('set-cookie')

    const options: any = { status: res.ok ? 200 : res.status, headers: Object.assign({}, { 'content-type': ct }, cacheHeaders(req)) }
    if (sc) {
      // Strip Domain attribute so cookies can be set for our app's domain (best-effort)
      options.headers['set-cookie'] = sc.replace(/;\s*Domain=[^;]+/gi, '')
    }

    return new NextResponse(text, options)
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
