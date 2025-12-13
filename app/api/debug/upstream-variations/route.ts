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
    const res = await fetch(`${origin}/api/timetable`, { headers: { accept: 'application/json' } })
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
              const perMatch = periodKey ? (norm(String(periodKey)) === norm(p.period)) : true
              const subjMatch = subj ? (norm(String(subj)) === norm(p.subject)) : true
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
