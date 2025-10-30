import { NextRequest, NextResponse } from 'next/server';

// Normalize a wide variety of SBHS API item shapes into our Period type
function toPeriod(item: any) {
  const start = item.start || item.timeStart || item.startTime || item.from || item.begin || ''
  const end = item.end || item.timeEnd || item.finish || item.to || item.until || ''
  const time = [start, end].filter(Boolean).join(' - ')
  const subject = item.subject || item.class || item.title || item.name || 'Class'
  const teacher = item.teacher || item.classTeacher || item.staff || item.teacherName || ''
  const room = item.room || item.venue || item.location || ''
  const period = String(item.period || item.p || item.block || item.name || '')
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
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://student.sbhs.net.au/',
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
      // Attempt common shapes: j.days = { Monday: [...], ... } or j.timetable = {...}
      const daysObj = j.days || j.timetable || j.week || null
      if (daysObj && typeof daysObj === 'object') {
        for (const key of Object.keys(byDay)) {
          const arr = (daysObj[key] || daysObj[key.toLowerCase()] || []) as any[]
          if (Array.isArray(arr)) byDay[key] = arr.map(toPeriod)
        }
      } else if (Array.isArray(j)) {
        // If it is just an array, assume it is for today
        const dow = new Date().toLocaleDateString('en-US', { weekday: 'long' })
        byDay[dow] = j.map(toPeriod)
      }
    }

    // If day timetable returned, merge/override today's entries
    if (dayRes && (dayRes as any).json) {
      const dj = (dayRes as any).json
      let arr: any[] = Array.isArray(dj) ? dj : (dj.periods || dj.entries || dj.data || [])
      if (!Array.isArray(arr)) arr = []
      const dow = dateParam
        ? new Date(dateParam).toLocaleDateString('en-US', { weekday: 'long' })
        : new Date().toLocaleDateString('en-US', { weekday: 'long' })
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
