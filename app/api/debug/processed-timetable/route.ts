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
    const rawCookie = req.headers.get('cookie') || ''
    const headers: Record<string, string> = { accept: 'application/json' }
    if (rawCookie) headers['cookie'] = rawCookie

    // Fetch /api/timetable and substitutions in parallel.
    const ttPromise = fetch(`${origin}/api/timetable`, { headers })
    const subsPromise = fetch(`${origin}/api/portal/substitutions?debug=1`, { headers })
    const [ttSettled, subsSettled] = await Promise.allSettled([ttPromise, subsPromise])
    let j: any = null

    if (ttSettled.status === 'fulfilled' && ttSettled.value) {
      const res = ttSettled.value
      if (res.ok) {
        j = await res.json().catch(() => null)
      } else if (res.status === 401 && subsSettled.status === 'fulfilled' && subsSettled.value && subsSettled.value.ok) {
        const subsJson = await subsSettled.value.json().catch(() => null)
        j = { timetable: subsJson?.timetable || {}, upstream: subsJson?.raw || subsJson }
      } else if (!res.ok) {
        return NextResponse.json({ error: 'failed to fetch /api/timetable', status: res.status }, { status: 502, headers: cacheHeaders(req) })
      }
    } else {
      if (subsSettled.status === 'fulfilled' && subsSettled.value && subsSettled.value.ok) {
        const subsJson = await subsSettled.value.json().catch(() => null)
        j = { timetable: subsJson?.timetable || {}, upstream: subsJson?.raw || subsJson }
      } else {
        return NextResponse.json({ error: 'failed to fetch /api/timetable', status: 502 }, { status: 502, headers: cacheHeaders(req) })
      }
    }

    const upstream = j?.upstream || j?.diagnostics?.upstream || null
    const dayObj = upstream?.day || null
    const classVars = collect(dayObj?.classVariations || upstream?.classVariations || upstream?.class_variations)
    const roomVars = collect(dayObj?.roomVariations || upstream?.roomVariations || upstream?.room_variations)

    const base: Record<string, any[]> = j?.timetable || { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
    const trim = (p: any) => ({ period: p?.period, time: p?.time, subject: p?.subject, teacher: p?.teacher, room: p?.room })
    const mapped: Record<string, any[]> = {}
    for (const d of Object.keys(base || {})) mapped[d] = (base[d] || []).map((p: any) => ({ ...trim(p) }))

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
                // apply casual/substitute metadata when present
                if (v.casualSurname && !(p as any).casualSurname) {
                  (p as any).casualSurname = String(v.casualSurname)
                  (p as any).isSubstitute = true
                  try { (p as any).displayTeacher = String(v.casualSurname) } catch (e) {}
                }
                if (v.casual && !(p as any).casualToken) (p as any).casualToken = String(v.casual)
                if ((v.substitute || v.replacement || v.substituteTeacher) && !(p as any).isSubstitute) {
                  (p as any).isSubstitute = true
                  if (v.substituteTeacher) (p as any).teacher = String(v.substituteTeacher)
                  if (v.substituteTeacherFull) (p as any).fullTeacher = String(v.substituteTeacherFull)
                  try { if (!(p as any).displayTeacher && (p as any).fullTeacher) (p as any).displayTeacher = String((p as any).fullTeacher) } catch (e) {}
                }
                const toRoom = v.toRoom || v.roomTo || v.room_to || v.to || v.room || v.newRoom
                if (toRoom && String(toRoom).trim()) {
                  const cand = String(toRoom).trim()
                  if (!((p as any).displayRoom)) {
                    (p as any).displayRoom = cand
                    (p as any).isRoomChange = true
                  }
                }
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }

    const trimmedOriginal: Record<string, any[]> = {}
    for (const d of Object.keys(base || {})) trimmedOriginal[d] = (base[d] || []).map((p: any) => trim(p))
    return NextResponse.json({ originalTimetable: trimmedOriginal, processedTimetable: mapped, classVars, roomVars }, { headers: cacheHeaders(req) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500, headers: cacheHeaders(req) })
  }
}
