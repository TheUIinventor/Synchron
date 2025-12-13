import { NextResponse } from 'next/server'

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
    let res = await fetch(`${origin}/api/timetable`, { headers: { accept: 'application/json' } })
    // If /api/timetable requires auth, try the portal substitutions proxy as a fallback
    if (!res.ok && res.status === 401) {
      try {
        const subsRes = await fetch(`${origin}/api/portal/substitutions?debug=1`, { headers: { accept: 'application/json' } })
        if (subsRes.ok) {
          const subsJson = await subsRes.json()
          // Construct a minimal payload shaped like /api/timetable so downstream
          // mapping logic can run. If the portal proxy returned { substitutions },
          // attach those under upstream for consistency.
          const jsubs: any = { timetable: {}, upstream: subsJson.raw || subsJson }
          res = { ok: true, status: 200, json: async () => jsubs } as unknown as Response
        } else {
          return NextResponse.json({ error: 'failed to fetch /api/timetable', status: res.status }, { status: 502 })
        }
      } catch (e) {
        return NextResponse.json({ error: 'failed to fetch /api/timetable', status: res.status }, { status: 502 })
      }
    }
    if (!res.ok) return NextResponse.json({ error: 'failed to fetch /api/timetable', status: res.status }, { status: 502 })
    const j = await res.json()

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

    return NextResponse.json({ upstream: upstream || null, classVars, roomVars, mapping: results, timetableHead: Object.keys(base).reduce((acc: any, k) => { acc[k] = (base[k]||[]).slice(0,6); return acc }, {}) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
