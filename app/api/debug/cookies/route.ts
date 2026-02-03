import { NextResponse } from 'next/server'

export const runtime = 'edge'
const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => { try { const hasCookie = req && req.headers && typeof req.headers.get === 'function' && Boolean(req.headers.get('cookie')); return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE } } catch (e) { return { 'Cache-Control': SHARED_CACHE } } }

function parseCookies(cookieHeader: string | null) {
  if (!cookieHeader) return {}
  return cookieHeader.split(';').map(s => s.trim()).filter(Boolean).reduce((acc: Record<string,string>, cur) => {
    const idx = cur.indexOf('=')
    if (idx === -1) return acc
    const name = cur.slice(0, idx).trim()
    const value = cur.slice(idx + 1)
    acc[name] = value
    return acc
  }, {})
}

function mask(v: string) {
  if (!v) return ''
  if (v.length <= 8) return v.replace(/./g, '*')
  return `${v.slice(0,4)}…${v.slice(-4)}`
}

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie')
    const cookies = parseCookies(cookieHeader)
    const masked: Record<string,string> = {}
    for (const k of Object.keys(cookies)) {
      masked[k] = mask(cookies[k])
    }

    return NextResponse.json({ ok: true, cookies: masked, count: Object.keys(masked).length }, { headers: cacheHeaders(req) })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500, headers: cacheHeaders(req) })
  }
}
