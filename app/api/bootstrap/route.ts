import { NextRequest, NextResponse } from 'next/server'
import { getStatic } from '@/lib/cache/static-cache'
import { cheapAuthCheck } from '@/lib/auth/checkAuth'

const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=300'

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl
    const dateParam = url.searchParams.get('date') || new Date().toISOString().slice(0,10)

    const auth = await cheapAuthCheck(req)
    const isAnon = !auth.authenticated

    const cacheKey = `bootstrap:${isAnon ? 'public' : 'auth'}:${auth.tokenMeta?.sub || 'anon'}:${dateParam}`

    if (isAnon) {
      // Serve a cached public bootstrap payload to reduce repeated invocations.
      const payload = await getStatic(cacheKey, 1000 * 30, async () => {
        // Only include public-safe endpoints here. Notices require auth so omit.
        const base = req.nextUrl.origin
        const timetableP = fetch(`${base}/api/timetable?date=${encodeURIComponent(dateParam)}`, { cache: 'no-store' }).then(r => r.ok ? r.json().catch(() => null) : null)
        const portalHomeP = fetch(`${base}/api/portal/home-timetable`, { cache: 'no-store' }).then(r => r.ok ? r.json().catch(() => null) : null)
        const calendarP = fetch(`${base}/api/calendar?endpoint=days&from=${encodeURIComponent(dateParam)}&to=${encodeURIComponent(dateParam)}`, { cache: 'no-store' }).then(r => r.ok ? r.json().catch(() => null) : null)

        const [timetable, portalHome, calendar] = await Promise.all([timetableP, portalHomeP, calendarP])
        return { date: dateParam, timetable, portalHome, calendar }
      })

      return NextResponse.json(payload, { headers: { 'Cache-Control': SHARED_CACHE } })
    }

    // Authenticated path: assemble personalized data in parallel. Do not
    // cache per-user payloads globally; rely on per-endpoint caching.
    const base = req.nextUrl.origin
    const opts = { credentials: 'include' as RequestCredentials, cache: 'no-store' as RequestCache }
    const [userinfoR, timetableR, noticesR, portalHomeR, calendarR] = await Promise.all([
      fetch(`${base}/api/portal/userinfo`, opts).catch(() => null),
      fetch(`${base}/api/timetable?date=${encodeURIComponent(dateParam)}`, opts).catch(() => null),
      fetch(`${base}/api/notices`, opts).catch(() => null),
      fetch(`${base}/api/portal/home-timetable`, opts).catch(() => null),
      fetch(`${base}/api/calendar?endpoint=days&from=${encodeURIComponent(dateParam)}&to=${encodeURIComponent(dateParam)}`, opts).catch(() => null),
    ])

    const [userinfo, timetable, notices, portalHome, calendar] = await Promise.all([
      userinfoR && userinfoR.ok ? userinfoR.json().catch(() => null) : null,
      timetableR && timetableR.ok ? timetableR.json().catch(() => null) : null,
      noticesR && noticesR.ok ? noticesR.json().catch(() => null) : null,
      portalHomeR && portalHomeR.ok ? portalHomeR.json().catch(() => null) : null,
      calendarR && calendarR.ok ? calendarR.json().catch(() => null) : null,
    ])

    const payload = { date: dateParam, userinfo, timetable, notices, portalHome, calendar }
    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: 'bootstrap error', details: String(e) }, { status: 500 })
  }
}
