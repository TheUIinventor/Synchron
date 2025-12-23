import { NextRequest, NextResponse } from 'next/server'
import { cheapAuthCheck } from '@/lib/auth/checkAuth'

export const runtime = 'edge'

type ProfileCacheEntry = { ts: number; payload: any }
const PROFILE_TTL = 1000 * 60 * 10 // 10 minutes per-session cache

export async function GET(req: NextRequest) {
  try {
    const auth = await cheapAuthCheck(req)
    const accessToken = auth.token
    const sub = auth.tokenMeta?.sub || null

    if (!accessToken || !sub) {
      return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 })
    }

    // Global per-instance cache keyed by subject (sub) to avoid repeated upstream fetches
    try { (globalThis as any).__profile_cache = (globalThis as any).__profile_cache || new Map<string, ProfileCacheEntry>() } catch (e) {}
    const cache: Map<string, ProfileCacheEntry> = (globalThis as any).__profile_cache
    try {
      const entry = cache.get(sub)
      if (entry && (Date.now() - entry.ts) < PROFILE_TTL) {
        return NextResponse.json(entry.payload, { headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' } })
      }
    } catch (e) {}

    const apiUrl = 'https://student.sbhs.net.au/details/userinfo.json'
    const headers: Record<string,string> = { 'Accept': 'application/json', 'Authorization': `Bearer ${accessToken}` }
    // Forward cookies if present
    const incoming = req.headers.get('cookie')
    if (incoming) headers['Cookie'] = incoming

    const r = await fetch(apiUrl, { headers })
    if (!r.ok) {
      const t = await r.text().catch(() => null)
      return NextResponse.json({ success: false, error: 'Upstream error', status: r.status, body: t }, { status: r.status })
    }

    const ct = r.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      const text = await r.text().catch(() => null)
      return NextResponse.json({ success: false, error: 'Unexpected content-type', contentType: ct, snippet: text ? text.slice(0, 1024) : null }, { status: 502 })
    }

    const j = await r.json()
    try { cache.set(sub, { ts: Date.now(), payload: j }) } catch (e) {}
    return NextResponse.json(j, { headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' } })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
