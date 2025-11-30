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
  const fullTeacher = item.fullTeacher || item.full_teacher || item.fullTeacherName || item.full_teacher_name || item.fullname || item.full_name || ''
  const room = item.room || item.roomName || item.room_name || item.venue || item.location || ''
  const period = String(item.period || item.p || item.block || item.lesson || item.lessonNumber || item.lesson_number || item.name || item.title || '')
  // Avoid using subject/title/name fields when inferring week type because class
  // names sometimes include trailing group letters (e.g. "MAT A") which falsely
  // indicate a week letter. Only consider explicit week-like fields.
  const weekType = normalizeWeekType(
    item.weekType || item.week_type || item.week || item.rotation || item.cycle || item.weekLabel || item.week_label || item.dayname || item.dayName || item.day
  ) || fallbackWeekType

  // Preserve subject exactly as provided (trim only). Do NOT remove trailing
  // A/B group suffixes because they are part of the class name.
  try {
    subject = String(subject || '').trim()
  } catch (e) {}

  return { period, time, subject, teacher, fullTeacher: fullTeacher || undefined, room, weekType: weekType ?? undefined }
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
      // Track source of each bucket so clients can tell whether it came from
      // the bells API, from an upstream day-specific bells array, or is empty.
      const bellSources: Record<string, string> = { 'Mon/Tues': 'empty', 'Wed/Thurs': 'empty', Fri: 'empty' }
      try {
        const bellsArr = Array.isArray(bj) ? bj : (bj.bells || bj.periods || [])
        // Friendly mapping for common portal bell labels
        const bellLabelMap: Record<string, string> = {
          'RC': 'Roll Call',
          'R': 'Recess',
          'MTL1': 'Lunch 1',
          'MTL2': 'Lunch 2',
          'MTL': 'Lunch',
          'L': 'Lunch'
        }
        // If the bells payload includes a top-level day/date field it means
        // the entire bells array applies to a specific date (e.g. Wednesday).
        // Map the whole array into the bucket for that day so we don't rely
        // on per-bell `pattern` properties which many payloads omit.
        const topLevelDayRaw = (bj && (bj.day || bj.date || bj.dayName || bj.dayname)) ? String(bj.day || bj.date || bj.dayName || bj.dayname).toLowerCase() : null
        if (topLevelDayRaw) {
          const target = topLevelDayRaw.includes('fri') ? 'Fri' : (topLevelDayRaw.includes('wed') || topLevelDayRaw.includes('thu') || topLevelDayRaw.includes('thur')) ? 'Wed/Thurs' : 'Mon/Tues'
          const mappedAll = (bellsArr || []).map((b: any) => {
            const rawLabel = String(b.period || b.name || b.title || b.bellDisplay || '').trim()
            const key = rawLabel.toUpperCase()
            const friendly = bellLabelMap[key] || (b.bellDisplay || rawLabel)
            const bs = b.start || b.startTime || b.timeStart || b.from || b.start_time || b.starttime
            const be = b.end || b.endTime || b.timeEnd || b.to || b.end_time || b.endtime
            const timeStr = [bs, be].filter(Boolean).join(' - ')
            return { period: String(friendly || rawLabel), originalPeriod: rawLabel, time: timeStr }
          })
          schedules[target] = schedules[target].concat(mappedAll)
          bellSources[target] = 'api'
        } else {
          for (const b of bellsArr) {
            const rawLabel = String(b.period || b.name || b.title || b.bellDisplay || '').trim()
            const key = rawLabel.toUpperCase()
            const friendly = bellLabelMap[key] || (b.bellDisplay || rawLabel)
            const bs = b.start || b.startTime || b.timeStart || b.from || b.start_time || b.starttime
            const be = b.end || b.endTime || b.timeEnd || b.to || b.end_time || b.endtime
            const timeStr = [bs, be].filter(Boolean).join(' - ')
            const entry = { period: String(friendly || rawLabel), originalPeriod: rawLabel, time: timeStr }
            const pattern = (b.dayPattern || b.pattern || b.day || '').toString().toLowerCase()
            if (pattern.includes('mon') || pattern.includes('tue')) { schedules['Mon/Tues'].push(entry); bellSources['Mon/Tues'] = 'api' }
            else if (pattern.includes('wed') || pattern.includes('thu') || pattern.includes('thur')) { schedules['Wed/Thurs'].push(entry); bellSources['Wed/Thurs'] = 'api' }
            else if (pattern.includes('fri')) { schedules['Fri'].push(entry); bellSources['Fri'] = 'api' }
            else { schedules['Mon/Tues'].push(entry); if (bellSources['Mon/Tues'] === 'empty') bellSources['Mon/Tues'] = 'api' }
          }
        }
      } catch (e) {
        // ignore bell adaptation errors; client will fall back to defaults
      }
      // If some buckets are empty (e.g. Wed/Thurs or Fri) try to backfill
      // them using the detailed per-day bells that may be present in the
      // full or day timetable responses (some portal endpoints include a
      // `day.bells` array with a dayName/routine that indicates which
      // weekday the bells apply to). This prevents the common case where
      // the bells.json payload is generic and lacks a `pattern` field.
      try {
        const upstreamDay = (fullRes && (fullRes as any).json && (fullRes as any).json.day && Array.isArray((fullRes as any).json.day.bells) && (fullRes as any).json.day.bells.length)
          ? (fullRes as any).json.day
          : (dayRes && (dayRes as any).json && (dayRes as any).json.day && Array.isArray((dayRes as any).json.day.bells) && (dayRes as any).json.day.bells.length)
            ? (dayRes as any).json.day
            : null

        if (upstreamDay) {
          const rawDayName = String(upstreamDay.dayName || upstreamDay.dayname || upstreamDay.day || upstreamDay.date || '').toLowerCase()
          const bucket = rawDayName.includes('fri') ? 'Fri' : (rawDayName.includes('wed') || rawDayName.includes('thu') || rawDayName.includes('thur')) ? 'Wed/Thurs' : 'Mon/Tues'
          if (Array.isArray(upstreamDay.bells) && upstreamDay.bells.length) {
            const bellLabelMap: Record<string, string> = {
              'RC': 'Roll Call',
              'R': 'Recess',
              'MTL1': 'Lunch 1',
              'MTL2': 'Lunch 2',
              'MTL': 'Lunch',
              'L': 'Lunch'
            }
            const mapped = (upstreamDay.bells || []).map((b: any) => {
              const rawLabel = String(b.bellDisplay || b.period || b.bell || '').trim()
              const key = rawLabel.toUpperCase()
              const friendly = bellLabelMap[key] || (b.bellDisplay || rawLabel)
              const timeStr = (b.startTime || b.time || '') + (b.endTime ? (' - ' + b.endTime) : '')
              return { period: String(friendly || rawLabel), originalPeriod: rawLabel, time: timeStr }
            })
            // Only replace if the target bucket is empty to avoid overwriting explicit patterns
            if (!schedules[bucket] || schedules[bucket].length === 0) {
              schedules[bucket] = mapped.slice()
              bellSources[bucket] = 'upstream-day'
            }
          }
        }
      } catch (e) {
        // ignore backfill errors
      }
      // expose schedules variable outside so response can include it
      var bellSchedules = schedules
      var bellTimesSources = bellSources
      try {
        // Helpful debug output during development: show which buckets were
        // populated and whether a top-level day or upstream day bells were
        // observed. The client can then use this to verify API-derived
        // bell times aren't being discarded later in the fetch/retry flow.
        const _tl = topLevelDayRaw || null
        // rawDayName may be set further below when upstreamDay is detected;
        // include it if available.
        // eslint-disable-next-line no-console
        console.debug('[timetable.route] bellTimesSources:', bellTimesSources, 'topLevelDay:', _tl, 'bellsCount:', (bellsArr || []).length)
      } catch (e) {
        /* ignore logging errors */
      }
    }

    // Deduplicate entries per-day. Upstream payloads (full.days, timetable, bells, day) can contain
    // the same logical period multiple times via different shapes; perform a stable dedupe so the
    // client doesn't receive repeated identical rows. Key uses period/time/subject/teacher/room/weekType.
    // Keep normalizeString as trim-only; do not collapse internal whitespace.
    const normalizeString = (v: any) => (v == null ? '' : String(v).trim())

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
    const formatTimePart = (part: string) => {
      if (!part) return ''
      const m = String(part).trim().match(/(\d{1,2})\s*:?\s*(\d{0,2})/)
      if (!m) return part.trim()
      const h = parseInt(m[1], 10)
      const min = m[2] ? parseInt(m[2], 10) : 0
      if (!Number.isFinite(h) || !Number.isFinite(min)) return part.trim()
      return `${pad(h)}:${pad(min)}`
    }

    const normalizeTime = (t: any) => {
      const s = normalizeString(t)
      if (!s) return ''
      // Split on dash-like separators, tolerate variants like '-' '–' '—'
      const parts = s.split(/\s*[\-–—]\s*/)
      const start = formatTimePart(parts[0] || '')
      const end = parts[1] ? formatTimePart(parts[1]) : ''
      return end ? `${start} - ${end}` : start
    }

    const parseStartMinutes = (timeStr: any) => {
      try {
        const s = normalizeTime(timeStr)
        const part = s.split('-')[0].trim()
        const [hStr, mStr] = String(part).split(':')
        const h = parseInt(hStr, 10)
        const m = parseInt(mStr || '0', 10)
        if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m
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
          // Keep subject as-is (trimmed) including any group suffixes
          const rawSubject = normalizeString(p.subject)
          const subjectKey = rawSubject.toUpperCase()
          const subjectDisplay = rawSubject
          const teacherKey = normalizeString(p.teacher).toUpperCase()
          const roomKey = normalizeString(p.room).toUpperCase()
          const weekTypeKey = normalizeString(p.weekType).toUpperCase()
          // include start minute in the dedupe key to avoid merging distinct periods that share labels
          const key = [period, startMin, subjectKey, teacherKey, roomKey, weekTypeKey].join('|')
          if (!seen.has(key)) seen.set(key, { ...p, period, time, subject: subjectDisplay, teacher: normalizeString(p.teacher), fullTeacher: normalizeString(p.fullTeacher), room: normalizeString(p.room), weekType: weekTypeKey || undefined })
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
        const subjectKey = rawSubject.toUpperCase()
        const subjectDisplay = rawSubject
        const teacherKey = normalizeString(p.teacher).toUpperCase()
        const roomKey = normalizeString(p.room).toUpperCase()
        const weekTypeKey = normalizeString(p.weekType).toUpperCase()
        const key = [period, startMin, subjectKey, teacherKey, roomKey, weekTypeKey].join('|')
        if (!seen.has(key)) seen.set(key, { ...p, period, time, subject: subjectDisplay, teacher: normalizeString(p.teacher), fullTeacher: normalizeString(p.fullTeacher), room: normalizeString(p.room), weekType: weekTypeKey || undefined })
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

    // Prefer explicit upstream `weekType` when present on any of the
    // fetched JSON responses (day/full/bells). This ensures the portal's
    // canonical week marker takes precedence over heuristic inference.
    const upstreamExplicitWeek = (
      (dayRes && (dayRes as any).json && ((dayRes as any).json.weekType || (dayRes as any).json.week || (dayRes as any).json.week_label)) ||
      (fullRes && (fullRes as any).json && ((fullRes as any).json.weekType || (fullRes as any).json.week || (fullRes as any).json.week_label)) ||
      (bellsRes && (bellsRes as any).json && ((bellsRes as any).json.weekType || (bellsRes as any).json.week || (bellsRes as any).json.week_label))
    )

    let weekType = null as WeekType | null
    if (upstreamExplicitWeek) {
      const s = String(upstreamExplicitWeek).trim().toUpperCase()
      if (s === 'A' || s === 'B') weekType = s as WeekType
      else {
        const m = s.match(/\b([AB])\b/)
        if (m && m[1]) weekType = m[1].toUpperCase() as WeekType
      }
    }
    // Only use an explicit upstream week marker. Do NOT apply heuristics or
    // parity fallbacks — if the portal does not provide `weekType` then the
    // route will leave the week unset (null) so the client can decide how to
    // behave. We still compute diagnostics above but they are informational
    // only and are not used to select the canonical week.
    const finalWeekType = weekType as WeekType | null

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
      bellTimesSources: typeof bellTimesSources !== 'undefined' ? bellTimesSources : undefined,
      source: 'sbhs-api',
      weekType: finalWeekType,
      diagnostics: {
        detectedWeekType: detectedWeekType ?? null,
        dominantWeekType: dominantWeekType ?? null,
        inferredWeekParityFallback: null,
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
