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

    // Fetch normalized timetable from our own API route
    const ttRes = await fetch(`${origin}/api/timetable`, { headers: { accept: 'application/json' } })
    const subsRes = await fetch(`${origin}/api/portal/substitutions?debug=1`, { headers: { accept: 'application/json' } })

    if (!ttRes.ok) return NextResponse.json({ error: 'Failed to fetch /api/timetable', status: ttRes.status }, { status: 502, headers: cacheHeaders(req) })
    if (!subsRes.ok) return NextResponse.json({ error: 'Failed to fetch /api/portal/substitutions', status: subsRes.status }, { status: 502, headers: cacheHeaders(req) })

    const ttJson = await ttRes.json()
    const subsJson = await subsRes.json()

    const baseTimetable: Record<string, any[]> = ttJson?.timetable || {}
    const substitutions: any[] = subsJson?.substitutions || []

    // Shallow clone timetable structure
    const processed: Record<string, any[]> = {}
    Object.keys(baseTimetable).forEach((d) => {
      processed[d] = (baseTimetable[d] || []).map((p: any) => ({ ...p }))
    })

    // Apply simplified substitution logic for debugging purposes
    substitutions.forEach((sub) => {
      if (!sub) return
      const targetDays = sub.date ? ([dayNameFromDateString(sub.date)].filter(Boolean) as string[]) : Object.keys(processed)

      targetDays.forEach((day) => {
        (processed[day] || []).forEach((period) => {
          // period match
          const subPeriod = normalize(sub.period)
          const perPeriod = normalize(period.period)
          const periodMatch = sub.period ? (subPeriod === perPeriod) : true
          const subjectMatch = sub.subject ? (normalize(sub.subject) === normalize(period.subject)) : true
          if (!periodMatch || !subjectMatch) return

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
        })
      })
    })

    return NextResponse.json({ timetable: baseTimetable, processed, substitutions, upstreamRaw: subsJson.raw || null }, { headers: cacheHeaders(req) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500, headers: cacheHeaders(req) })
  }
}
