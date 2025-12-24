import { NextResponse } from 'next/server'

export const runtime = 'edge'
const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => { try { const hasCookie = req && req.headers && typeof req.headers.get === 'function' && Boolean(req.headers.get('cookie')); return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE } } catch (e) { return { 'Cache-Control': SHARED_CACHE } } }

// Lightweight server-side processor to apply normalized substitutions
// to the normalized timetable returned by our `/api/timetable` route.
// This duplicates only the small subset of logic we need for debugging
// (non-destructive `displayRoom`, casual surname -> displayTeacher),
// avoiding imports from client-only modules.

function normalize(s?: any) {
  try { return (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '').trim() } catch { return '' }
}

function dayNameFromDateString(d?: string) {
  if (!d) return null
  try {
    const dt = new Date(d)
    if (!Number.isNaN(dt.getTime())) return dt.toLocaleDateString('en-US', { weekday: 'long' })
  } catch {}
  // fallback: match textual day names
  const low = String(d || '').toLowerCase()
  const names = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  for (const n of names) if (low.includes(n)) return n[0].toUpperCase() + n.slice(1)
  return null
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const origin = url.origin

    // Fetch normalized timetable and substitutions in parallel to reduce latency
    const [ttSettled, subsSettled] = await Promise.allSettled([
      fetch(`${origin}/api/timetable`, { headers: { accept: 'application/json' } }),
      fetch(`${origin}/api/portal/substitutions?debug=1`, { headers: { accept: 'application/json' } })
    ])

    if (ttSettled.status !== 'fulfilled' || !(ttSettled.value && ttSettled.value.ok)) return NextResponse.json({ error: 'Failed to fetch /api/timetable' }, { status: 502, headers: cacheHeaders(req) })
    if (subsSettled.status !== 'fulfilled' || !(subsSettled.value && subsSettled.value.ok)) return NextResponse.json({ error: 'Failed to fetch /api/portal/substitutions' }, { status: 502, headers: cacheHeaders(req) })

    const ttJson = await ttSettled.value.json().catch(() => null)
    const subsJson = await subsSettled.value.json().catch(() => null)

    const baseTimetable: Record<string, any[]> = ttJson?.timetable || {}
    const substitutions: any[] = subsJson?.substitutions || []

    // Shallow clone and trim timetable structure to only fields we need
    const processed: Record<string, any[]> = {}
    const trimPeriod = (p: any) => ({ period: p?.period, time: p?.time, subject: p?.subject, teacher: p?.teacher, room: p?.room })
    // Also build normalized metadata to avoid repeated normalization in inner loops
    const mappedMeta: Record<string, { p: any; normPeriod: string; normSubject: string; numericPeriod?: string }[]> = {}
    Object.keys(baseTimetable).forEach((d) => {
      processed[d] = (baseTimetable[d] || []).map((p: any) => ({ ...trimPeriod(p) }))
      mappedMeta[d] = (baseTimetable[d] || []).map((p: any) => {
        const perStr = String(p?.period || '')
        const subjStr = String(p?.subject || '')
        const nk = normalize(perStr)
        const sk = normalize(subjStr)
        const dp = (perStr.match(/\d+/) || [])[0]
        return { p, normPeriod: nk, normSubject: sk, numericPeriod: dp }
      })
    })

    // Apply simplified substitution logic for debugging purposes using precomputed metadata
    substitutions.forEach((sub) => {
      if (!sub) return
      const targetDays = sub.date ? ([dayNameFromDateString(sub.date)].filter(Boolean) as string[]) : Object.keys(processed)

      // Normalize variation keys once
      const subPeriodNorm = normalize(sub.period)
      const subPeriodNum = (String(sub.period || '').match(/\d+/) || [])[0]
      const subSubjectNorm = normalize(sub.subject)

      targetDays.forEach((day) => {
        const metaArr = mappedMeta[day] || []
        for (const m of metaArr) {
          try {
            const perMatch = sub.period
              ? ((subPeriodNorm && subPeriodNorm === m.normPeriod) || (subPeriodNum && m.numericPeriod && subPeriodNum === m.numericPeriod) || (m.normPeriod.includes(subPeriodNorm) && subPeriodNorm.length>0) || (subPeriodNorm.includes(m.normPeriod) && m.normPeriod.length>0))
              : true
            const subjMatch = sub.subject ? ((subSubjectNorm && subSubjectNorm === m.normSubject) || m.normSubject.includes(subSubjectNorm) || subSubjectNorm.includes(m.normSubject)) : true
            if (!perMatch || !subjMatch) continue

            const period = processed[day]?.find((pp: any) => String(pp.period || '') === String(m.p?.period || ''))
            if (!period) continue

            // Apply casual/substitute teacher when present
            if (sub.casualSurname || sub.substituteTeacherFull || sub.substituteTeacher) {
              if (!period.originalTeacher) period.originalTeacher = period.teacher
              if (sub.casualSurname) {
                period.casualSurname = String(sub.casualSurname).trim()
                period.casualToken = sub.casual ? String(sub.casual).trim() : undefined
                period.displayTeacher = period.casualSurname
                period.teacher = period.casualSurname
                period.isSubstitute = true
              } else if (sub.substituteTeacherFull) {
                period.displayTeacher = String(sub.substituteTeacherFull)
                period.teacher = String(sub.substituteTeacher || period.teacher)
                period.isSubstitute = true
              } else if (sub.substituteTeacher) {
                period.displayTeacher = String(sub.substituteTeacher)
                period.teacher = String(sub.substituteTeacher)
                period.isSubstitute = true
              }
            }

            // Apply explicit destination room (non-destructive)
            if (sub.toRoom || sub.roomTo || sub.newRoom || sub.to) {
              const candidate = String(sub.toRoom || sub.roomTo || sub.newRoom || sub.to).trim()
              if (candidate && candidate.toLowerCase() !== String(period.room || '').trim().toLowerCase()) {
                period.displayRoom = candidate
                period.isRoomChange = true
              }
            } else if (sub.room) {
              const candidate = String(sub.room).trim()
              if (candidate && candidate.toLowerCase() !== String(period.room || '').trim().toLowerCase()) {
                period.displayRoom = candidate
              }
            }
          } catch (e) {}
        }
      })
    })

    // Also return a trimmed view of the original timetable to avoid forwarding unnecessary fields
    const trimmedOriginal: Record<string, any[]> = {}
    Object.keys(baseTimetable).forEach((d) => trimmedOriginal[d] = (baseTimetable[d] || []).map((p: any) => trimPeriod(p)))
    return NextResponse.json({ timetable: trimmedOriginal, processed, substitutions, upstreamRaw: subsJson?.raw || null }, { headers: cacheHeaders(req) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500, headers: cacheHeaders(req) })
  }
}
