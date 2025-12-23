import { NextRequest, NextResponse } from 'next/server'
import { getStatic } from '@/lib/cache/static-cache'
import { cheapAuthCheck } from '@/lib/auth/checkAuth'

// Import internal route handlers so we can call them directly inside the
// same function invocation. This avoids issuing internal HTTP requests
// which on serverless platforms can spawn extra function invocations
// and increase Active CPU usage.
import { GET as timetableGET } from '../timetable/route'
import { GET as userinfoGET } from '../portal/userinfo/route'
import { GET as noticesGET } from '../notices/route'
import { GET as portalHomeGET } from '../portal/home-timetable/route'
import { GET as calendarGET } from '../calendar/route'

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
        // Call the internal handlers directly rather than fetching internal
        // endpoints over HTTP. Reuse the incoming `req` so handlers can
        // inspect query/cookies/headers as before.
        const fakeReq = req as NextRequest

        const timetableRes = await timetableGET(fakeReq).catch(() => null)
        const portalHomeRes = await portalHomeGET(fakeReq).catch(() => null)
        const calendarRes = await calendarGET(fakeReq).catch(() => null)

        const timetable = timetableRes && typeof (timetableRes as any).json === 'function' ? await (timetableRes as any).json().catch(() => null) : null
        const portalHome = portalHomeRes && typeof (portalHomeRes as any).json === 'function' ? await (portalHomeRes as any).json().catch(() => null) : null
        const calendar = calendarRes && typeof (calendarRes as any).json === 'function' ? await (calendarRes as any).json().catch(() => null) : null

        return { date: dateParam, timetable, portalHome, calendar }
      })

      return NextResponse.json(payload, { headers: { 'Cache-Control': SHARED_CACHE } })
    }

    // Authenticated path: assemble personalized data in parallel. Do not
    // cache per-user payloads globally; rely on per-endpoint caching.
    // Authenticated path: assemble personalized data in parallel. Call
    // internal handlers directly to avoid extra invocations.
    const fakeReq = req as NextRequest

    const [userinfoRes, timetableRes, noticesRes, portalHomeRes, calendarRes] = await Promise.all([
      userinfoGET(fakeReq).catch(() => null),
      timetableGET(fakeReq).catch(() => null),
      noticesGET(fakeReq).catch(() => null),
      portalHomeGET(fakeReq).catch(() => null),
      calendarGET(fakeReq).catch(() => null),
    ])

    const userinfo = userinfoRes && typeof (userinfoRes as any).json === 'function' ? await (userinfoRes as any).json().catch(() => null) : null
    const timetable = timetableRes && typeof (timetableRes as any).json === 'function' ? await (timetableRes as any).json().catch(() => null) : null
    const notices = noticesRes && typeof (noticesRes as any).json === 'function' ? await (noticesRes as any).json().catch(() => null) : null
    const portalHome = portalHomeRes && typeof (portalHomeRes as any).json === 'function' ? await (portalHomeRes as any).json().catch(() => null) : null
    const calendar = calendarRes && typeof (calendarRes as any).json === 'function' ? await (calendarRes as any).json().catch(() => null) : null

    const payload = { date: dateParam, userinfo, timetable, notices, portalHome, calendar }
    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: 'bootstrap error', details: String(e) }, { status: 500 })
  }
}
