import { NextRequest, NextResponse } from 'next/server';

type WeekType = 'A' | 'B'

function normalizeWeekType(value: any): WeekType | null {
  if (value == null) return null
  const str = String(value).trim().toUpperCase()
  if (!str) return null
  // Exact single-letter values are valid
  if (str === 'A' || str === 'B') return str as WeekType

  // Prefer explicit mentions like "WEEK A", "WEEK: B", "ROTATION A", etc.
  const explicit = str.match(/\b(?:WEEK|WEEKTYPE|WEEK_LABEL|CYCLE|ROTATION|ROT)\b[^A-Z0-9]*([AB])\b/)
  if (explicit && explicit[1]) return explicit[1] as WeekType

  // Do NOT match single letters inside longer strings (eg. class names like "MAT A").
  // Only accept an explicit single-letter string which we already handled above.

  return null
}

function inferWeekType(dayKey?: any, source?: any): WeekType | null {
  const candidates = [
    source?.weekType,
    source?.week_type,
    source?.week,
    source?.weekLabel,
    source?.week_label,
    source?.cycle,
    source?.rotation,
    source?.dayname,
    source?.dayName,
    dayKey,
  ]
  for (const c of candidates) {
    const normalized = normalizeWeekType(c)
    if (normalized) return normalized
  }
  // Special-case: dayKey values like 'MonA' / 'TueB' encode week letter as last char
  try {
    if (typeof dayKey === 'string') {
      const m = dayKey.match(/^[A-Za-z]{3,4}([AB])$/i)
      if (m && m[1]) return m[1].toUpperCase() as WeekType
    }
    if (source && typeof source === 'object' && typeof source.dayname === 'string') {
      const m2 = (source.dayname as string).match(/^[A-Za-z]{3,4}([AB])$/i)
      if (m2 && m2[1]) return m2[1].toUpperCase() as WeekType
    }
  } catch (e) {}
  return null
}

// Normalize a wide variety of SBHS API item shapes into our Period type
function toPeriod(item: any, fallbackWeekType: WeekType | null = null) {
  const start = item.start || item.startTime || item.timeStart || item.from || item.begin || item.start_time || ''
  const end = item.end || item.finish || item.timeEnd || item.endTime || item.end_time || item.to || item.until || ''
  const time = [start, end].filter(Boolean).join(' - ')
  let subject = item.subject || item.subjectName || item.subject_name || item.class || item.title || item.name || 'Class'
  const teacher = item.teacher || item.teacherName || item.teacher_name || item.classTeacher || item.staff || item.staffName || ''
  const room = item.room || item.roomName || item.room_name || item.venue || item.location || ''
  const period = String(item.period || item.p || item.block || item.lesson || item.lessonNumber || item.lesson_number || item.name || item.title || '')
  // Avoid using subject/title/name fields when inferring week type because class
  // names sometimes include trailing group letters (e.g. "MAT A") which falsely
  // indicate a week letter. Only consider explicit week-like fields.
  const weekType = normalizeWeekType(
    item.weekType || item.week_type || item.week || item.rotation || item.cycle || item.weekLabel || item.week_label || item.dayname || item.dayName || item.day
  ) || fallbackWeekType

  // Normalize subject by removing trailing single-letter group suffixes like " A" or " B"
  try {
    const m = String(subject || '').trim().match(/^(.+?)\s+([AB])$/i)
    if (m && m[1]) subject = m[1].trim()
  } catch (e) {}

  return { period, time, subject, teacher, room, weekType: weekType ?? undefined }
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
    // Helper to coerce various SBHS JSON shapes into an array of period-like entries
    const extractPeriods = (value: any): any[] | null => {
      if (!value) return null
      if (Array.isArray(value)) return value
      if (value && typeof value === 'object') {
        if (Array.isArray((value as any).periods)) return (value as any).periods
        const periodsObj = (value as any).periods
        if (periodsObj && typeof periodsObj === 'object') {
          return Object.entries(periodsObj).map(([key, val]) => {
            if (val && typeof val === 'object') return { period: key, ...(val as any) }
            return { period: key, title: val }
          })
        }
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Sometimes the value itself is an object keyed by period numbers
        const entries = Object.entries(value)
        if (entries.length && entries.every(([, v]) => v && typeof v === 'object')) {
          return entries.map(([key, val]) => ({ period: key, ...(val as any) }))
        }
      }
      return null
    }

    const deriveDayCandidate = (fallback: any, source?: any) => {
      if (source && typeof source === 'object') {
        const obj = source as any
        return obj.dayname || obj.dayName || obj.day || obj.day_label || obj.title || obj.name || fallback
      }
      return fallback
    }
    let detectedWeekType: WeekType | null = null

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

    const responses = [dayRes, fullRes, bellsRes]
    const authError = responses.find((r: any) => r && (r.status === 401 || r.status === 403))
    if (authError) {
      const payload = authError.json ?? authError.text ?? authError.html ?? null
      return NextResponse.json(
        {
          error: 'Unauthorized from SBHS timetable API',
          details: payload,
          diagnostics: {
            hasAccessToken: !!accessToken,
            forwardedCookies: incomingCookie ? true : false,
            hostTried: responses.map((r: any) => r?.status ?? null),
          },
        },
        { status: authError.status },
      )
    }

    const explicitError = responses.find((r: any) => {
      if (!r || !r.json) return false
      const data = r.json
      const message = (data?.error || data?.message || data?.status_message || '').toString().toLowerCase()
      if (!message) return false
      return message.includes('unauth') || message.includes('token') || message.includes('expired')
    })
    if (explicitError) {
      return NextResponse.json(
        {
          error: 'SBHS timetable API reported an authorization problem',
          details: explicitError.json,
          diagnostics: {
            hasAccessToken: !!accessToken,
            forwardedCookies: incomingCookie ? true : false,
            hostTried: responses.map((r: any) => r?.status ?? null),
          },
        },
        { status: 401 },
      )
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
        const lettersOnly = lower.replace(/[^a-z]/g, '')
        const exact = dayNames.find(d => d.toLowerCase() === lower)
        if (exact) return exact
        const contains = dayNames.find(d => lower.includes(d.toLowerCase()))
        if (contains) return contains
        if (lettersOnly) {
          const prefix = dayNames.find(d => lettersOnly.startsWith(d.slice(0, 3).toLowerCase()))
          if (prefix) return prefix
        }
        const asDate = new Date(raw)
        if (!Number.isNaN(asDate.getTime())) {
          const fromDate = asDate.toLocaleDateString('en-US', { weekday: 'long' })
          if (dayNames.includes(fromDate)) return fromDate
        }
        return dayNames[new Date().getDay()] || 'Monday'
      }

    const assign = (dayKey: any, items: any[], source?: any) => {
    if (!Array.isArray(items)) return
    const normalizedKey = resolveDayKey(dayKey)
    if (!byDay[normalizedKey]) byDay[normalizedKey] = []
    const inferred: WeekType | null = inferWeekType(dayKey, source) || detectedWeekType
    if (inferred) detectedWeekType = inferred
    // Append periods rather than replace so A/B variants don't overwrite each other
    byDay[normalizedKey] = byDay[normalizedKey].concat(items.map((entry: any) => toPeriod(entry, inferred)))
  }

      const candidateObjects = [j.days, j.timetable, j.week, j.data, j.schedule]
      for (const obj of candidateObjects) {
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          for (const [k, v] of Object.entries(obj)) {
            const derivedKey = deriveDayCandidate(k, v)
            if (Array.isArray(v)) assign(derivedKey, v, v)
            else if (v && typeof v === 'object') {
              const extracted = extractPeriods(v)
              if (extracted) assign(derivedKey, extracted, v)
            }
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
            const inferred: WeekType | null = inferWeekType(dayField, item) || detectedWeekType
            if (inferred) detectedWeekType = inferred
            byDay[normalizedKey].push(toPeriod(item, inferred))
          }
        } else {
          const extracted = extractPeriods(arr)
          if (Array.isArray(extracted)) {
            for (const item of extracted) {
              const dayField = item?.day || item?.dayName || item?.dayname || item?.weekday || item?.week_day || item?.day_of_week || item?.date
              const normalizedKey = resolveDayKey(dayField)
              if (!byDay[normalizedKey]) byDay[normalizedKey] = []
              const inferred: WeekType | null = inferWeekType(dayField, item) || detectedWeekType
              if (inferred) detectedWeekType = inferred
              byDay[normalizedKey].push(toPeriod(item, inferred))
            }
          }
        }
      }
    }

    // If day timetable returned, merge/override today's entries
    if (dayRes && (dayRes as any).json) {
      const dj = (dayRes as any).json
      let arr: any[] = Array.isArray(dj) ? dj : (dj.periods || dj.entries || dj.data || [])
      if (!Array.isArray(arr) && dj?.day?.periods) {
        arr = Array.isArray(dj.day.periods) ? dj.day.periods : extractPeriods(dj.day.periods) || []
      }
      if (!Array.isArray(arr) && dj?.timetable?.periods) {
        const extracted = extractPeriods(dj.timetable)
        if (extracted) arr = extracted
      }
      if (!Array.isArray(arr)) arr = []
      const dowDate = dateParam ? new Date(dateParam) : new Date()
      const dow = Number.isNaN(dowDate.getTime())
        ? new Date().toLocaleDateString('en-US', { weekday: 'long' })
        : dowDate.toLocaleDateString('en-US', { weekday: 'long' })
      const inferred: WeekType | null = inferWeekType(dow, dj.dayInfo || dj.timetable || dj)
      if (inferred) detectedWeekType = inferred
      byDay[dow] = arr.map((entry: any) => toPeriod(entry, inferred))
    }

    // Optionally refine times using bells
    if (fullRes && (fullRes as any).json) {
      const j = (fullRes as any).json
      const dayNames = Object.keys(byDay)
      const resolveDayKey = (input: any): string => {
        if (!input) return dayNames[new Date().getDay()] || 'Monday'
        const raw = typeof input === 'string' ? input : input.name || input.label || ''
        if (!raw) return dayNames[new Date().getDay()] || 'Monday'
        const lower = raw.toLowerCase()
        const lettersOnly = lower.replace(/[^a-z]/g, '')
        const exact = dayNames.find(d => d.toLowerCase() === lower)
        if (exact) return exact
        const contains = dayNames.find(d => lower.includes(d.toLowerCase()))
        if (contains) return contains
        if (lettersOnly) {
          const prefix = dayNames.find(d => lettersOnly.startsWith(d.slice(0, 3).toLowerCase()))
          if (prefix) return prefix
        }
        const asDate = new Date(raw)
        if (!Number.isNaN(asDate.getTime())) {
          const fromDate = asDate.toLocaleDateString('en-US', { weekday: 'long' })
          if (dayNames.includes(fromDate)) return fromDate
        }
        return dayNames[new Date().getDay()] || 'Monday'
      }

      const assign = (dayKey: any, items: any[], source?: any) => {
        if (!Array.isArray(items)) return
        const normalizedKey = resolveDayKey(dayKey)
        if (!byDay[normalizedKey]) byDay[normalizedKey] = []
        const inferred: WeekType | null = inferWeekType(dayKey, source) || detectedWeekType
        if (inferred) detectedWeekType = inferred
        // Append instead of replace so structured 'days' entries for A/B don't overwrite
        byDay[normalizedKey] = byDay[normalizedKey].concat(items.map((entry: any) => toPeriod(entry, inferred)))
      }

      const candidateObjects = [j.days, j.timetable, j.week, j.data, j.schedule]
      for (const obj of candidateObjects) {
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          for (const [k, v] of Object.entries(obj)) {
            const derivedKey = deriveDayCandidate(k, v)
            if (Array.isArray(v)) assign(derivedKey, v, v)
            else if (v && typeof v === 'object') {
              const extracted = extractPeriods(v)
              if (extracted) assign(derivedKey, extracted, v)
            }
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
        } else {
          const extracted = extractPeriods(arr)
          if (Array.isArray(extracted)) {
            for (const item of extracted) {
              const dayField = item?.day || item?.dayName || item?.dayname || item?.weekday || item?.week_day || item?.day_of_week || item?.date
              const normalizedKey = resolveDayKey(dayField)
              if (!byDay[normalizedKey]) byDay[normalizedKey] = []
              byDay[normalizedKey].push(toPeriod(item))
            }
          }
        }
      }

      // Backfill days that are still empty using the structured `days` object
      if (j.days && typeof j.days === 'object') {
        for (const [rawKey, value] of Object.entries(j.days)) {
          if (!value || typeof value !== 'object') continue
          const derivedKey = deriveDayCandidate(rawKey, value)
          const periods = extractPeriods((value as any).periods ? { periods: (value as any).periods } : value)
          if (!periods || !periods.length) continue
          const normalizedKey = resolveDayKey(derivedKey || rawKey)
          if (!byDay[normalizedKey] || byDay[normalizedKey].length === 0) {
            const inferred: WeekType | null = inferWeekType(derivedKey || rawKey, value) || detectedWeekType
            if (inferred) detectedWeekType = inferred
            byDay[normalizedKey] = periods.map((entry: any) => toPeriod(entry, inferred))
          }
        }
      }
    }

    if (bellsRes && (bellsRes as any).json) {
      const bj = (bellsRes as any).json
      // Expect bj contains a collection of bell times with period names and start/end
      const bells = Array.isArray(bj) ? bj : (bj.bells || bj.periods || [])
      if (Array.isArray(bells) && bells.length) {
        const mapTime: Record<string, { start: string, end: string }> = {}
        for (const b of bells) {
          const label = String(b.period || b.name || b.title || '').trim()
          const bs = b.start || b.startTime || b.timeStart || b.from
          const be = b.end || b.endTime || b.timeEnd || b.to
          if (label && (bs || be)) mapTime[label] = { start: bs || '', end: be || '' }
        }
        for (const day of Object.keys(byDay)) {
          byDay[day] = byDay[day].map((p: any) => {
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
      // Build a normalized bell schedules object so clients can consume accurate
      // break times instead of relying on built-in defaults. The API may include
      // a `dayPattern` (e.g. 'mon-tue','wed-thu','fri') or similar; we try to
      // map those into our three buckets: 'Mon/Tues', 'Wed/Thurs', 'Fri'.
      const schedules: Record<string, { period: string; time: string }[]> = { 'Mon/Tues': [], 'Wed/Thurs': [], Fri: [] }
      try {
        const bellsArr = Array.isArray(bj) ? bj : (bj.bells || bj.periods || [])
        for (const b of bellsArr) {
          const label = String(b.period || b.name || b.title || '').trim()
          const bs = b.start || b.startTime || b.timeStart || b.from || b.start_time || b.starttime
          const be = b.end || b.endTime || b.timeEnd || b.to || b.end_time || b.endtime
          const timeStr = [bs, be].filter(Boolean).join(' - ')
          const entry = { period: label, time: timeStr }
          const pattern = (b.dayPattern || b.pattern || b.day || '').toString().toLowerCase()
          if (pattern.includes('mon') || pattern.includes('tue')) schedules['Mon/Tues'].push(entry)
          else if (pattern.includes('wed') || pattern.includes('thu') || pattern.includes('thur')) schedules['Wed/Thurs'].push(entry)
          else if (pattern.includes('fri')) schedules['Fri'].push(entry)
          else schedules['Mon/Tues'].push(entry)
        }
      } catch (e) {
        // ignore bell adaptation errors; client will fall back to defaults
      }
      // expose schedules variable outside so response can include it
      var bellSchedules = schedules
    }

    // Deduplicate entries per-day. Upstream payloads (full.days, timetable, bells, day) can contain
    // the same logical period multiple times via different shapes; perform a stable dedupe so the
    // client doesn't receive repeated identical rows. Key uses period/time/subject/teacher/room/weekType.
    const normalizeString = (v: any) => (v == null ? '' : String(v).trim())
    const normalizeTime = (t: any) => {
      const s = normalizeString(t)
      // Normalize common alternate spacings like "09:00-10:00" vs "09:00 - 10:00"
      return s.replace(/\s*-\s*/g, ' - ')
    }
    const parseStartMinutes = (timeStr: any) => {
      try {
        const s = normalizeString(timeStr)
        const part = s.split('-')[0].trim()
        const [h, m] = part.split(':').map((x: string) => parseInt(x, 10))
        if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + (Number.isFinite(m) ? m : 0)
      } catch (e) {}
      return -1
    }

    const dedupePerDay = (b: Record<string, any[]>) => {
      for (const [dayName, periods] of Object.entries(b)) {
        const seen = new Map<string, any>()
        for (const p of periods) {
          const period = normalizeString(p.period)
          const time = normalizeTime(p.time)
          const startMin = parseStartMinutes(time)
          // Strip trailing A/B from subject for dedupe key so group suffixes don't split duplicates
          const rawSubject = normalizeString(p.subject)
          const subjNoSuffix = rawSubject.replace(/\s+([AB])$/i, '')
          const subject = subjNoSuffix.toUpperCase()
          const subjectDisplay = subjNoSuffix
          const teacher = normalizeString(p.teacher).toUpperCase()
          const room = normalizeString(p.room).toUpperCase()
          const weekTypeKey = normalizeString(p.weekType).toUpperCase()
          const key = [period, startMin, subject, teacher, room, weekTypeKey].join('|')
          if (!seen.has(key)) seen.set(key, { ...p, period, time, subject: subjectDisplay, teacher, room, weekType: weekTypeKey || undefined })
        }
        b[dayName] = Array.from(seen.values())
      }
    }

    dedupePerDay(byDay)

    // If some weekdays remain empty but the full timetable has entries, backfill from the detailed days object
    // Remove obvious placeholder entries with no useful information
    for (const dayName of Object.keys(byDay)) {
      byDay[dayName] = byDay[dayName].filter(p => {
        const hasSubject = p.subject && p.subject.toLowerCase() !== 'class'
        const hasTeacher = p.teacher && p.teacher.trim().length > 0
        const hasRoom = p.room && p.room.trim().length > 0
        const hasTimeRange = typeof p.time === 'string' && p.time.includes('-')
        return hasTimeRange && (hasSubject || hasTeacher || hasRoom)
      })
    }

    // Build a grouped view per weekday split by week-type (A/B/unknown).
    // We keep the original `timetable: byDay` for backward compatibility and
    // provide `timetableByWeek` for clients that want explicit A/B buckets.
    const dedupeArray = (arr: any[]) => {
      const seen = new Map<string, any>()
      for (const p of arr) {
        const period = normalizeString(p.period)
        const time = normalizeTime(p.time)
        const startMin = parseStartMinutes(time)
        const rawSubject = normalizeString(p.subject)
        const subjNoSuffix = rawSubject.replace(/\s+([AB])$/i, '')
        const subject = subjNoSuffix.toUpperCase()
        const subjectDisplay = subjNoSuffix
        const teacher = normalizeString(p.teacher).toUpperCase()
        const room = normalizeString(p.room).toUpperCase()
        const weekTypeKey = normalizeString(p.weekType).toUpperCase()
        const key = [period, startMin, subject, teacher, room, weekTypeKey].join('|')
        if (!seen.has(key)) seen.set(key, { ...p, period, time, subject: subjectDisplay, teacher, room, weekType: weekTypeKey || undefined })
      }
      return Array.from(seen.values())
    }

    const timetableByWeek: Record<string, { A: any[]; B: any[]; unknown: any[] }> = {}
    for (const [dayName, periods] of Object.entries(byDay)) {
      const groups = { A: [] as any[], B: [] as any[], unknown: [] as any[] }
      for (const p of periods) {
        const wt = normalizeString(p.weekType).toUpperCase()
        if (wt === 'A') groups.A.push(p)
        else if (wt === 'B') groups.B.push(p)
        else groups.unknown.push(p)
      }
      // Deduplicate inside each group (in case duplicates slipped through)
      groups.A = dedupeArray(groups.A)
      groups.B = dedupeArray(groups.B)
      groups.unknown = dedupeArray(groups.unknown)
      timetableByWeek[dayName] = groups
    }

    const weekTally: Record<WeekType, number> = { A: 0, B: 0 }
    for (const groups of Object.values(timetableByWeek)) {
      weekTally.A += groups.A.length
      weekTally.B += groups.B.length
    }

    let dominantWeekType: WeekType | null = null
    const taggedTotal = weekTally.A + weekTally.B
    if (taggedTotal > 0) {
      if (weekTally.A === weekTally.B) {
        dominantWeekType = detectedWeekType
      } else {
        dominantWeekType = weekTally.A > weekTally.B ? 'A' : 'B'
      }
    }

    const weekType = dominantWeekType || detectedWeekType || inferWeekType(undefined, {
      bells: bellsRes?.json,
      day: dayRes?.json,
      full: fullRes?.json,
    })

    // If we still couldn't determine a week type from upstream data, fall back
    // to a parity-based inference using the ISO week number. This provides a
    // stable A/B toggle even when the portal omits explicit week tags.
    function isoWeekNumber(d: Date) {
      // Copy date so don't modify original
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      // Thursday in current week decides the year
      date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1))
      const weekNo = Math.floor(((+date - +yearStart) / 86400000 + 1) / 7) + 1
      return weekNo
    }

    let finalWeekType = weekType as WeekType | null
    if (!finalWeekType) {
      try {
        const today = new Date()
        const weekNo = isoWeekNumber(today)
        // Choose a mapping: odd -> A, even -> B. This is adjustable later.
        finalWeekType = (weekNo % 2) === 1 ? 'A' : 'B'
      } catch (e) {
        finalWeekType = null
      }
    }

    // Build per-day week tag counts for diagnostics using the grouped view
    const perDayWeekCounts: Record<string, { A: number; B: number; unknown: number }> = {}
    for (const [dayName, groups] of Object.entries(timetableByWeek)) {
      perDayWeekCounts[dayName] = { A: groups.A.length, B: groups.B.length, unknown: groups.unknown.length }
    }

    // Build explicit lists of periods tagged A/B/unknown for debugging from grouped view
    const weekBreakdown: { A: any[]; B: any[]; unknown: any[] } = { A: [], B: [], unknown: [] }
    for (const [dayName, groups] of Object.entries(timetableByWeek)) {
      for (const p of groups.A) weekBreakdown.A.push({ day: dayName, period: p.period, time: p.time, subject: p.subject, teacher: p.teacher, room: p.room })
      for (const p of groups.B) weekBreakdown.B.push({ day: dayName, period: p.period, time: p.time, subject: p.subject, teacher: p.teacher, room: p.room })
      for (const p of groups.unknown) weekBreakdown.unknown.push({ day: dayName, period: p.period, time: p.time, subject: p.subject, teacher: p.teacher, room: p.room })
    }

    const hasAny = Object.values(byDay).some(a => a.length)
    if (hasAny) return NextResponse.json({
      timetable: byDay,
      timetableByWeek,
      bellTimes: typeof bellSchedules !== 'undefined' ? bellSchedules : undefined,
      source: 'sbhs-api',
      weekType: finalWeekType,
      diagnostics: {
        detectedWeekType: detectedWeekType ?? null,
        dominantWeekType: dominantWeekType ?? null,
        inferredWeekParityFallback: finalWeekType ? finalWeekType : null,
        weekTally,
        perDayWeekCounts,
        weekBreakdown,
        // Include raw upstream payloads to help diagnose where A/B info may be present
        upstream: {
          day: dayRes?.json ?? null,
          full: fullRes?.json ?? null,
          bells: bellsRes?.json ?? null,
        }
      }
    })

    return NextResponse.json(
      {
        error: 'No timetable data available from SBHS API',
        upstream: {
          day: dayRes?.json ?? dayRes?.text ?? null,
          full: fullRes?.json ?? fullRes?.text ?? null,
          bells: bellsRes?.json ?? bellsRes?.text ?? null,
          statuses: {
            day: dayRes?.status ?? null,
            full: fullRes?.status ?? null,
            bells: bellsRes?.status ?? null,
          },
        },
        diagnostics: {
          hasAccessToken: !!accessToken,
          forwardedCookies: incomingCookie ? true : false,
        },
      },
      { status: 502 },
    )
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', details: String(error) }, { status: 500 })
  }
}
