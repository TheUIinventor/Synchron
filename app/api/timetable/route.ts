import { NextRequest, NextResponse } from 'next/server';

// Normalize a wide variety of SBHS API item shapes into our Period type
function toPeriod(item: any) {
  const start = item.start || item.startTime || item.timeStart || item.from || item.begin || item.start_time || ''
  const end = item.end || item.finish || item.timeEnd || item.endTime || item.end_time || item.to || item.until || ''
  const time = [start, end].filter(Boolean).join(' - ')
  const subject = item.subject || item.subjectName || item.subject_name || item.class || item.title || item.name || 'Class'
  const teacher = item.teacher || item.teacherName || item.teacher_name || item.classTeacher || item.staff || item.staffName || ''
  const room = item.room || item.roomName || item.room_name || item.venue || item.location || ''
  const period = String(item.period || item.p || item.block || item.lesson || item.lessonNumber || item.lesson_number || item.name || item.title || '')
  return { period, time, subject, teacher, room }
}

// This route proxies SBHS Timetable API endpoints shown in the portal docs:
// - /api/timetable/daytimetable.json (today or date=YYYY-MM-DD)
// - /api/timetable/timetable.json (complete timetable)
// - /api/timetable/bells.json (bell times for a date)
// It forwards browser cookies and bearer token to the portal and returns a
// normalized per-day timetable object.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const dateParam = url.searchParams.get('date') || undefined
  const accessToken = req.cookies.get('sbhs_access_token')?.value
  const incomingCookie = req.headers.get('cookie') || ''

  const baseHeaders: Record<string, string> = {
    'Accept': 'application/json, text/javascript, */*; q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://student.sbhs.net.au/',
    'Origin': 'https://student.sbhs.net.au',
    'Accept-Language': 'en-AU,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (incomingCookie) baseHeaders['Cookie'] = incomingCookie
  if (accessToken) baseHeaders['Authorization'] = `Bearer ${accessToken}`

  // Helper: fetch JSON from either student portal or API host, following small redirect chains
  async function getJson(path: string) {
    const sep = path.includes('?') ? '&' : '?'
    let nextUrl = dateParam ? `${path}${sep}date=${encodeURIComponent(dateParam)}` : path
    let response: Response | null = null
    for (let i = 0; i < 5; i++) {
      response = await fetch(nextUrl, { headers: baseHeaders, redirect: 'manual' })
      const code = response.status
      if ([301, 302, 303, 307, 308].includes(code)) {
        const loc = response.headers.get('location')
        if (loc) {
          // resolve relative redirects
          try { nextUrl = new URL(loc, nextUrl).toString() } catch { nextUrl = loc }
          continue
        }
      }
      break
    }
    if (!response) return { ok: false, status: 0, text: '' }
    const text = await response.text()
    const ctype = response.headers.get('content-type') || ''
    if (ctype.includes('application/json')) {
      try { return { ok: response.ok, json: JSON.parse(text), status: response.status } } catch { /* fallthrough */ }
    }
    if (text && text.trim().startsWith('<')) {
      return { ok: false, html: text, status: response.status }
    }
    return { ok: response.ok, text, status: response.status }
  }

  try {
    // Define candidate hosts and paths. If we have a bearer token, prefer the public API host as well.
    const hosts = [
      'https://student.sbhs.net.au',
      'https://api.sbhs.net.au',
    ]

    let dayRes: any = null
    let fullRes: any = null
    let bellsRes: any = null

    // Try each host until we get a JSON response
    for (const host of hosts) {
      const dr = await getJson(`${host}/api/timetable/daytimetable.json`)
      const fr = await getJson(`${host}/api/timetable/timetable.json`)
      const br = await getJson(`${host}/api/timetable/bells.json`)
      // If any of these responded with JSON, adopt them and stop trying further hosts
      if ((dr as any).json || (fr as any).json || (br as any).json) {
        dayRes = dr; fullRes = fr; bellsRes = br
        break
      }
      // Keep last responses for potential HTML forwarding below
      dayRes = dr; fullRes = fr; bellsRes = br
    }

    // If any returned HTML (likely login), forward that HTML so the client can handle
    if ((dayRes as any).html) {
      return new NextResponse((dayRes as any).html, { headers: { 'content-type': 'text/html; charset=utf-8' }, status: (dayRes as any).status || 401 })
    }
    if ((fullRes as any).html) {
      return new NextResponse((fullRes as any).html, { headers: { 'content-type': 'text/html; charset=utf-8' }, status: (fullRes as any).status || 401 })
    }

    // Normalize into per-day buckets
    const byDay: Record<string, any[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }

    // If full timetable exists, prefer it to populate multiple days
    if (fullRes && (fullRes as any).json) {
      const j = (fullRes as any).json
      const dayNames = Object.keys(byDay)
      const resolveDayKey = (input: any): string => {
        if (!input) return dayNames[new Date().getDay()] || 'Monday'
        const raw = typeof input === 'string' ? input : input.name || input.label || ''
        if (!raw) return dayNames[new Date().getDay()] || 'Monday'
        const lower = raw.toLowerCase()
        const exact = dayNames.find(d => d.toLowerCase() === lower)
        if (exact) return exact
        const contains = dayNames.find(d => lower.includes(d.toLowerCase()))
        if (contains) return contains
        const asDate = new Date(raw)
        if (!Number.isNaN(asDate.getTime())) {
          const fromDate = asDate.toLocaleDateString('en-US', { weekday: 'long' })
          if (dayNames.includes(fromDate)) return fromDate
        }
        return dayNames[new Date().getDay()] || 'Monday'
      }

      const assign = (dayKey: any, items: any[]) => {
        if (!Array.isArray(items)) return
        const normalizedKey = resolveDayKey(dayKey)
        if (!byDay[normalizedKey]) byDay[normalizedKey] = []
        byDay[normalizedKey] = items.map(toPeriod)
      }

      const candidateObjects = [j.days, j.timetable, j.week, j.data, j.schedule]
      for (const obj of candidateObjects) {
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          for (const [k, v] of Object.entries(obj)) {
            if (Array.isArray(v)) assign(k, v)
            else if (v && typeof v === 'object' && Array.isArray((v as any).periods)) assign(k, (v as any).periods)
          }
        }
      }

      const candidateArrays = [j.periods, j.entries, j.lessons, j.items, j.data, j.timetable, j.days, Array.isArray(j) ? j : null]
      for (const arr of candidateArrays) {
        if (Array.isArray(arr)) {
          for (const item of arr) {
            const dayField = item?.day || item?.dayName || item?.dayname || item?.weekday || item?.week_day || item?.day_of_week || item?.date
            const normalizedKey = resolveDayKey(dayField)
            if (!byDay[normalizedKey]) byDay[normalizedKey] = []
            byDay[normalizedKey].push(toPeriod(item))
          }
        }
      }
    }

    // If day timetable returned, merge/override today's entries
    if (dayRes && (dayRes as any).json) {
      const dj = (dayRes as any).json
      let arr: any[] = Array.isArray(dj) ? dj : (dj.periods || dj.entries || dj.data || [])
      if (!Array.isArray(arr) && dj?.day?.periods) arr = dj.day.periods
      if (!Array.isArray(arr)) arr = []
      const dowDate = dateParam ? new Date(dateParam) : new Date()
      const dow = Number.isNaN(dowDate.getTime())
        ? new Date().toLocaleDateString('en-US', { weekday: 'long' })
        : dowDate.toLocaleDateString('en-US', { weekday: 'long' })
      byDay[dow] = arr.map(toPeriod)
    }

    // Optionally refine times using bells
    if (bellsRes && (bellsRes as any).json) {
      const bj = (bellsRes as any).json
      // Expect bj contains a collection of bell times with period names and start/end
      const bells = Array.isArray(bj) ? bj : (bj.bells || bj.periods || [])
      if (Array.isArray(bells) && bells.length) {
        const mapTime: Record<string, { start: string, end: string }> = {}
        for (const b of bells) {
          const label = String(b.period || b.name || b.title || '').trim()
          const bs = b.start || b.timeStart || b.from
          const be = b.end || b.timeEnd || b.to
          if (label && (bs || be)) mapTime[label] = { start: bs || '', end: be || '' }
        }
        for (const day of Object.keys(byDay)) {
          byDay[day] = byDay[day].map(p => {
            if (!p.time || p.time.indexOf('-') === -1) {
              const t = mapTime[p.period] || mapTime[p.subject]
              if (t && (t.start || t.end)) {
                const range = [t.start, t.end].filter(Boolean).join(' - ')
                return { ...p, time: range }
              }
            }
            return p
          })
        }
      }
    }

    const hasAny = Object.values(byDay).some(a => a.length)
    if (hasAny) return NextResponse.json({ timetable: byDay, source: 'sbhs-api' })

    return NextResponse.json({ error: 'No timetable data available from SBHS API' }, { status: 502 })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', details: String(error) }, { status: 500 })
  }
}
