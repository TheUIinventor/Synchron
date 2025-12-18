import { NextResponse } from 'next/server'

export const runtime = 'edge'
const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => { try { const hasCookie = req && req.headers && typeof req.headers.get === 'function' && Boolean(req.headers.get('cookie')); return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE } } catch (e) { return { 'Cache-Control': SHARED_CACHE } } }

function norm(s?: any) { try { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim() } catch { return '' } }

function collect(v: any) {
  const items: any[] = []
  if (!v) return items
  if (Array.isArray(v)) return v.slice()
  if (typeof v === 'object') {
    for (const k of Object.keys(v)) {
      try {
        const it = (v as any)[k]
        if (it && typeof it === 'object') {
          const withKey = { ...(it as any), period: it.period || it.periodName || it.key || k }
          items.push(withKey)
        }
      } catch (e) {}
    }
  }
  return items
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const origin = url.origin
    // Forward the client's cookies when fetching internal endpoints so the
    // server-side fetch can act on behalf of an authenticated browser session.
    const rawCookie = req.headers.get('cookie') || ''
    const headers: Record<string, string> = { accept: 'application/json' }
    if (rawCookie) headers['cookie'] = rawCookie

    let res = await fetch(`${origin}/api/timetable`, { headers })
    let j: any
    // If /api/timetable requires auth, try the portal substitutions proxy as a fallback
    if (!res.ok && res.status === 401) {
      try {
        const subsRes = await fetch(`${origin}/api/portal/substitutions?debug=1`, { headers })
        if (subsRes.ok) {
          const subsJson = await subsRes.json()
          // Build a minimal /api/timetable-shaped payload so the mapping logic
          // can operate. Put the portal proxy result under `upstream`.
          j = { timetable: subsJson.timetable || {}, upstream: subsJson.raw || subsJson }
        } else {
          return NextResponse.json({ error: 'failed to fetch /api/timetable', status: res.status }, { status: 502, headers: cacheHeaders(req) })
        }
      } catch (e) {
        return NextResponse.json({ error: 'failed to fetch /api/timetable', status: res.status }, { status: 502, headers: cacheHeaders(req) })
      }
    } else {
      if (!res.ok) return NextResponse.json({ error: 'failed to fetch /api/timetable', status: res.status }, { status: 502 })
      j = await res.json()
    }

    const upstream = j?.upstream || j?.diagnostics?.upstream || null
    const dayObj = upstream?.day || null
    const classVars = collect(dayObj?.classVariations || upstream?.classVariations || upstream?.class_variations)
    const roomVars = collect(dayObj?.roomVariations || upstream?.roomVariations || upstream?.room_variations)

    // Build a copy of the timetable map to illustrate mapping
    const base: Record<string, any[]> = j?.timetable || {}
    const mapped: Record<string, any[]> = {}
    for (const d of Object.keys(base || {})) mapped[d] = (base[d] || []).map((p: any) => ({ ...(p as any) }))

    const results: any[] = []
    const all = [...classVars, ...roomVars]
    for (const v of all) {
      try {
        const periodKey = v.period || v.periodName || v.key || v.p || undefined
        const subj = v.title || v.subject || v.class || undefined
        const dateRaw = dayObj && (dayObj.date || dayObj.day) ? String(dayObj.date || dayObj.day) : undefined
        const targetDays = dateRaw ? Object.keys(mapped).filter(k => k && k.toLowerCase().includes(new Date(dateRaw).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase())) : Object.keys(mapped)
        for (const day of targetDays) {
          const arr = mapped[day] || []
          for (const p of arr) {
            try {
              // tolerant matching: normalized equality, numeric match, or substring
              const perKey = String(periodKey || '')
              const perStr = String(p.period || '')
              const nk = norm(perKey)
              const np = norm(perStr)
              const dk = (perKey.match(/\d+/) || [])[0]
              const dp = (perStr.match(/\d+/) || [])[0]
              const perMatch = periodKey
                ? ( (nk && nk === np) || (dk && dp && dk === dp) || (np.includes(nk) && nk.length>0) || (nk.includes(np) && np.length>0) )
                : true
              const sk = norm(String(subj || ''))
              const sp = norm(String(p.subject || ''))
              const subjMatch = subj ? ( (sk && sk === sp) || sp.includes(sk) || sk.includes(sp) ) : true
              if (perMatch && subjMatch) {
                // record mapping
                results.push({ variation: v, day, matchedPeriod: p.period, matchedSubject: p.subject })
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }

    return NextResponse.json({ upstream: upstream || null, classVars, roomVars, mapping: results, timetableHead: Object.keys(base).reduce((acc: any, k) => { acc[k] = (base[k]||[]).slice(0,6); return acc }, {}) }, { headers: cacheHeaders(req) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500, headers: cacheHeaders(req) })
  }
}
