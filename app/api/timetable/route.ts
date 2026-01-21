import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => {
  try {
    const hasCookie = req && req.headers && typeof req.headers.get === 'function' && Boolean(req.headers.get('cookie'))
    return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE }
  } catch (e) { return { 'Cache-Control': SHARED_CACHE } }
}

type WeekType = 'A' | 'B'

function normalizeWeekType(value: any): WeekType | null {
  if (value == null) return null
  const str = String(value).trim().toUpperCase()
  if (!str) return null
  // Exact single-letter values are valid (A or B)
  if (str === 'A' || str === 'B') return str as WeekType

  // Prefer explicit mentions like "WEEK A", "WEEK: B", "ROTATION C", etc.
  const explicit = str.match(/\b(?:WEEK|WEEKTYPE|WEEK_LABEL|CYCLE|ROTATION|ROT)\b[^A-Z0-9]*([AB])\b/)
  if (explicit && explicit[1]) return explicit[1] as WeekType

  // Handle dayname patterns like "MonA", "TueB", "WedA", etc.
  // The week letter is at the end after the day abbreviation
  const daynameMatch = str.match(/^(?:MON|TUE|WED|THU|FRI|SAT|SUN)[A-Z]*([AB])$/i)
  if (daynameMatch && daynameMatch[1]) return daynameMatch[1].toUpperCase() as WeekType

  // Do NOT match single letters inside longer strings (eg. class names like "MAT A").
  // Only accept an explicit single-letter string which we already handled above.

  return null
}

function inferWeekType(dayKey?: any, source?: any): WeekType | null {
  // Check explicit weekType fields first
  const candidates = [
    source?.weekType,
    source?.week_type,
    source?.week,
    source?.weekLabel,
    source?.week_label,
    source?.cycle,
    source?.rotation,
  ]
  for (const c of candidates) {
    const normalized = normalizeWeekType(c)
    if (normalized) return normalized
  }
  
  // Also check dayname (e.g., "MonA", "TueB") to extract week type
  // This is critical for building full timetable from days[] where each day
  // has a dayname indicating which week it belongs to
  const dayname = source?.dayname || source?.dayName || source?.day_name
  if (dayname) {
    const normalized = normalizeWeekType(dayname)
    if (normalized) return normalized
  }
  
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
  // Subject colour (hex without # prefix, e.g., "448ae6")
  const colour = item.colour || item.color || undefined
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

  return { period, time, subject, teacher, fullTeacher: fullTeacher || undefined, room, weekType: weekType ?? undefined, colour }
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
    // If the client requested a specific date, prefer that date when
    // resolving ambiguous/unknown weekday labels. This prevents the
    // route from falling back to the server's current day (which can
    // differ in CI/edge environments) and causing the client to see
    // the wrong weekday (e.g. Monday when the requested date is Friday).
    const requestedDate = dateParam ? new Date(dateParam) : null
    const requestedDayIndex = (requestedDate && !Number.isNaN(requestedDate.getTime())) ? requestedDate.getDay() : new Date().getDay()
    const requestedWeekdayString = (requestedDate && !Number.isNaN(requestedDate.getTime())) ? requestedDate.toLocaleDateString('en-US', { weekday: 'long' }) : new Date().toLocaleDateString('en-US', { weekday: 'long' })

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
    // Initialize bell schedules and sources for final response
    let bellSchedules: Record<string, { period: string; time: string }[]> | undefined = undefined
    let bellTimesSources: Record<string, string> | undefined = undefined

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
      const dayUrl = dateParam 
        ? `${host}/api/timetable/daytimetable.json?date=${dateParam}`
        : `${host}/api/timetable/daytimetable.json`
      const bellUrl = dateParam
        ? `${host}/api/timetable/bells.json?date=${dateParam}`
        : `${host}/api/timetable/bells.json`
      const fullUrl = `${host}/api/timetable/timetable.json`
      
      // OPTIMIZATION: Fetch all 3 endpoints in parallel for faster loading
      const [dr, fr, br] = await Promise.all([
        getJson(dayUrl),
        getJson(fullUrl),
        getJson(bellUrl)
      ])
      
      // If any of these responded with JSON, adopt them and stop trying further hosts
      if ((dr as any).json || (fr as any).json || (br as any).json) {
        dayRes = dr; fullRes = fr; bellsRes = br
        break
      }
      // Keep last responses for potential HTML forwarding below
      dayRes = dr; fullRes = fr; bellsRes = br
    }

    // Shared byDay structure - declared once here so date-specific path
    // can populate it and the aggregated path can extend/use the same data
    const byDay: Record<string, any[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }

    // If a specific date was requested, and the host returned a day-specific
    // JSON (`daytimetable.json`), prefer returning that payload directly so
    // clients that requested `/api/timetable?date=YYYY-MM-DD` receive the
    // authoritative per-day JSON rather than the aggregated full timetable.
    console.log(`[API DEBUG] dateParam=${dateParam}, dayRes.json exists=${!!(dayRes as any)?.json}`)
    if (dateParam) {
      try {
        if (dayRes && (dayRes as any).json) {
          const dj = (dayRes as any).json
          console.log(`[API DEBUG] Processing date-specific path for ${dateParam}`)
          console.log(`[API DEBUG] dj.bells length=${Array.isArray(dj.bells) ? dj.bells.length : 'not array'}`)
          console.log(`[API DEBUG] dj.classVariations keys=${dj.classVariations ? Object.keys(dj.classVariations).join(',') : 'none'}`)
          console.log(`[API DEBUG] dj.roomVariations keys=${dj.roomVariations ? Object.keys(dj.roomVariations).join(',') : 'none'}`)
          // Normalize the day response into the same shape we return for
          // the aggregated endpoint so clients receive `timetable`.
          // NOTE: byDay is declared above this block so we don't shadow it
          
          // The SBHS daytimetable.json response structure:
          // - dj.bells: array of bell times for the day
          // - dj.timetable.timetable.periods: object keyed by period (e.g., "1", "2", "RC")
          // - dj.timetable.subjects: object keyed by subject code
          // - dj.classVariations: object keyed by period - contains substitute teacher info
          // - dj.roomVariations: object keyed by period - contains room changes
          
          // Extract periods - prefer building from bells + periods like competitor does
          const bells = dj.bells || []
          const periodsObj = dj?.timetable?.timetable?.periods || dj?.timetable?.periods || {}
          // subjects can be an object keyed by "9ENG A" or an empty array [] - handle both cases
          const rawSubjects = dj?.timetable?.subjects
          const subjectsObj = (!Array.isArray(rawSubjects) && rawSubjects) ? rawSubjects : {}
          const classVars = !Array.isArray(dj.classVariations) ? (dj.classVariations || {}) : {}
          const roomVars = !Array.isArray(dj.roomVariations) ? (dj.roomVariations || {}) : {}
          
          // Debug: Log the extracted data structures
          console.log(`[API] periodsObj source: ${dj?.timetable?.timetable?.periods ? 'timetable.timetable.periods' : dj?.timetable?.periods ? 'timetable.periods' : 'empty fallback'}`)
          console.log(`[API] periodsObj keys: [${Object.keys(periodsObj).join(', ')}]`)
          console.log(`[API] rawSubjects type: ${Array.isArray(rawSubjects) ? 'array' : typeof rawSubjects}, isArray: ${Array.isArray(rawSubjects)}`)
          console.log(`[API] subjectsObj keys: [${Object.keys(subjectsObj).join(', ')}]`)
          // Debug: Log a sample subject to see its structure
          const firstSubjectKey = Object.keys(subjectsObj)[0]
          if (firstSubjectKey) {
            console.log(`[API] Sample subject "${firstSubjectKey}":`, JSON.stringify(subjectsObj[firstSubjectKey]))
          }
          if (bells.length > 0) {
            console.log(`[API] bells sample (first 2):`, JSON.stringify(bells.slice(0, 2)))
          }
          
          // Debug: Log the raw variations from API
          console.log(`[API] Raw classVariations type: ${Array.isArray(dj.classVariations) ? 'array' : typeof dj.classVariations}, keys: ${!Array.isArray(dj.classVariations) && dj.classVariations ? Object.keys(dj.classVariations).join(',') : 'none'}`)
          console.log(`[API] Raw roomVariations type: ${Array.isArray(dj.roomVariations) ? 'array' : typeof dj.roomVariations}, keys: ${!Array.isArray(dj.roomVariations) && dj.roomVariations ? Object.keys(dj.roomVariations).join(',') : 'none'}`)
          if (!Array.isArray(dj.roomVariations) && dj.roomVariations && Object.keys(dj.roomVariations).length > 0) {
            console.log(`[API] roomVariations content:`, JSON.stringify(dj.roomVariations))
          }
          
          const dowDate = new Date(dateParam)
          const dow = (!Number.isNaN(dowDate.getTime())) ? dowDate.toLocaleDateString('en-US', { weekday: 'long' }) : requestedWeekdayString
          const inferred: WeekType | null = inferWeekType(dow, dj.dayInfo || dj.timetable || dj)
          if (inferred) detectedWeekType = inferred
          
          // Check if this is a holiday/no-school day
          // SBHS returns bells (schedule structure) but empty periods during holidays
          // The key indicator is whether there are actual class periods, not just bells
          const hasPeriods = Object.keys(periodsObj).length > 0
          const hasBells = Array.isArray(bells) && bells.length > 0
          
          // Check if periods have actual class data (not just empty objects)
          // A period with no subject/title/teacher is not a real class
          const hasRealClasses = Object.values(periodsObj).some((p: any) => 
            p && (p.title || p.subject || p.teacher || p.room)
          )
          
          // A school day REQUIRES actual class periods with real data
          // During holidays, SBHS may return bell structure but no periods or empty periods
          const isSchoolDay = hasPeriods && hasRealClasses
          
          console.log(`[API] Holiday check: hasPeriods=${hasPeriods}, hasRealClasses=${hasRealClasses}, hasBells=${hasBells}, isSchoolDay=${isSchoolDay}`)
          console.log(`[API] periodsObj keys: [${Object.keys(periodsObj).join(', ')}]`)
          if (hasPeriods && !hasRealClasses) {
            console.log(`[API] periodsObj values (empty classes):`, JSON.stringify(periodsObj))
          }
          
          if (!isSchoolDay) {
            console.log(`[API] No classes for ${dateParam} - likely holiday or non-school day`)
            return NextResponse.json({
              timetable: byDay, // Empty timetable
              timetableByWeek: null,
              bellTimes: undefined,
              source: 'sbhs-api-day',
              weekType: detectedWeekType,
              isHoliday: true,
              noTimetable: true,
              upstream: { day: dj, full: null, bells: null },
            }, { status: 200, headers: cacheHeaders(req) })
          }
          
          // Build periods from bells (like competitor's dttSchema.transform)
          // This ensures we have proper timing info AND can apply variations
          if (Array.isArray(bells) && bells.length > 0) {
            const date = dj.date || dateParam
            
            byDay[dow] = bells.map((bell: any) => {
              const bellKey = bell.bell || bell.period || ''
              const periodData = periodsObj[bellKey] || {}
              
              // Build subject lookup key (year + title)
              // SBHS subjects are keyed like "9ENG A" (no space between year and shortTitle)
              let subjectKey = periodData.title || ''
              if (periodData.year) {
                subjectKey = periodData.year + subjectKey
              }
              // Try alternate key format with space if first lookup fails
              let subjectData = subjectsObj[subjectKey] || {}
              if (!subjectData.colour && periodData.year && periodData.title) {
                // Try with space: "9 ENG A" instead of "9ENG A"
                const altKey = periodData.year + ' ' + periodData.title
                if (subjectsObj[altKey]) {
                  subjectData = subjectsObj[altKey]
                }
              }
              
              // Debug: Log subject lookup for first few periods
              if (bellKey === '1' || bellKey === '2') {
                console.log(`[API] Subject lookup for P${bellKey}: key="${subjectKey}", found=${!!subjectsObj[subjectKey]}, colour="${subjectData.colour || 'none'}", availableKeys=${Object.keys(subjectsObj).slice(0, 3).join(',')}`)
              }
              
              // Check for class variation (substitute)
              const classVar = classVars[bellKey] || classVars[bell.period] || null
              let casualSurname: string | undefined = undefined
              let isSubstitute = false
              if (classVar && classVar.type !== 'novariation') {
                casualSurname = classVar.casualSurname || classVar.casual || undefined
                isSubstitute = !!casualSurname
                if (casualSurname) {
                  console.log(`[API] Applied substitute for P${bellKey}: ${casualSurname}`)
                }
              }
              
              // Check for room variation - only if it actually differs from scheduled room
              const roomVar = roomVars[bellKey] || roomVars[bell.period] || null
              let displayRoom: string | undefined = undefined
              let isRoomChange = false
              let originalRoom: string | undefined = undefined
              const scheduledRoom = String(periodData.room || '').trim()
              if (roomVar && roomVar.roomTo) {
                const newRoom = String(roomVar.roomTo).trim()
                // Only mark as room change if rooms actually differ
                if (newRoom && newRoom.toLowerCase() !== scheduledRoom.toLowerCase()) {
                  displayRoom = newRoom
                  isRoomChange = true
                  originalRoom = scheduledRoom
                  console.log(`[API] Applied room change for P${bellKey}: ${scheduledRoom} -> ${displayRoom}`)
                } else {
                  console.log(`[API] Skipping room change for P${bellKey}: same as scheduled (${scheduledRoom})`)
                }
              }
              
              const start = bell.startTime || bell.start || ''
              const end = bell.endTime || bell.end || ''
              const time = [start, end].filter(Boolean).join(' - ')
              
              // Extract colour from subject data (hex without # prefix)
              const subjectColour = subjectData.colour || undefined
              
              return {
                period: bellKey,
                time,
                subject: subjectData.title || periodData.title || bell.bellDisplay || bellKey,
                teacher: isSubstitute ? casualSurname : (periodData.fullTeacher || periodData.teacher || ''),
                fullTeacher: periodData.fullTeacher || undefined,
                room: periodData.room || '',
                weekType: inferred || undefined,
                // Subject colour (hex without # prefix, e.g., "448ae6")
                colour: subjectColour,
                // Substitution info
                casualSurname: casualSurname,
                isSubstitute,
                originalTeacher: isSubstitute ? (periodData.fullTeacher || periodData.teacher) : undefined,
                displayTeacher: isSubstitute ? casualSurname : undefined,
                // Room change info
                displayRoom,
                isRoomChange,
                originalRoom,
              }
            })
          } else {
            // Fallback: extract from periods array/object
            let arr: any[] = Array.isArray(dj) ? dj : (dj.periods || dj.entries || dj.data || [])
            if (!Array.isArray(arr) && dj?.day?.periods) {
              arr = Array.isArray(dj.day.periods) ? dj.day.periods : []
            }
            if (!Array.isArray(arr) && dj?.timetable?.periods) {
              const maybe = Array.isArray(dj.timetable.periods) ? dj.timetable.periods : null
              if (maybe) arr = maybe
            }
            // If periods is an object, convert to array
            if (!Array.isArray(arr) && periodsObj && typeof periodsObj === 'object') {
              arr = Object.entries(periodsObj).map(([key, val]) => ({ period: key, ...(val as any) }))
            }
            if (!Array.isArray(arr)) arr = []
            
            byDay[dow] = arr.map((entry: any) => {
              const periodKey = String(entry.period || entry.bell || '')
              const base: any = toPeriod(entry, inferred)
              
              // Apply class variation
              const classVar = classVars[periodKey] || null
              if (classVar && classVar.type !== 'novariation' && classVar.casualSurname) {
                base.casualSurname = classVar.casualSurname
                base.isSubstitute = true
                base.originalTeacher = base.teacher
                base.teacher = classVar.casualSurname
                base.displayTeacher = classVar.casualSurname
              }
              
              // Apply room variation - only if it actually differs from scheduled room
              const roomVar = roomVars[periodKey] || null
              if (roomVar && roomVar.roomTo) {
                const newRoom = String(roomVar.roomTo).trim()
                const currentRoom = String(base.room || '').trim()
                // Only mark as room change if the rooms actually differ
                if (newRoom && newRoom.toLowerCase() !== currentRoom.toLowerCase()) {
                  base.displayRoom = newRoom
                  base.isRoomChange = true
                  base.originalRoom = currentRoom // Preserve for UI
                }
              }
              
              return base
            })
          }

          const maybeBellTimes = dj.bellTimes || dj.bells || (bellsRes && (bellsRes as any).json) || undefined

          // Log summary of what we're returning
          const subsApplied = Object.values(byDay).flat().filter((p: any) => p.isSubstitute || p.casualSurname).length
          const roomChangesApplied = Object.values(byDay).flat().filter((p: any) => p.isRoomChange || p.displayRoom).length
          console.log(`[API DEBUG] Date-specific data extracted: ${Object.values(byDay).flat().length} periods, ${subsApplied} subs, ${roomChangesApplied} room changes`)

          // DON'T return early - fall through to full timetable processing
          // The full processing path will:
          // 1. Build all 15 days from fullRes (timetable.json)
          // 2. Override the requested day with dayRes data (daytimetable.json)
          // 3. Apply classVariations/roomVariations to the correct day
          // This ensures clients get ALL days, not just the requested one
          console.log(`[API DEBUG] Falling through to full timetable processing for date ${dateParam}`)
        }
      } catch (e) {
        console.error('[API] Error in date-specific path:', e)
        // fallthrough to aggregated handling
      }
    }

    const responses = [dayRes, fullRes, bellsRes]
    // Helper: attempt to build normalized bellSchedules from any available
    // response JSON (bells.json, day.bells inside day/full responses, etc.)
    const buildBellSchedulesFromResponses = (dayR: any, fullR: any, bellsR: any) => {
      try {
        const schedules: Record<string, { period: string; time: string }[]> = { 'Mon/Tues': [], 'Wed/Thurs': [], Fri: [] }
        const sources: Record<string, string> = { 'Mon/Tues': 'empty', 'Wed/Thurs': 'empty', Fri: 'empty' }
        const bj = bellsR && bellsR.json ? bellsR.json : null
        const tryExtractBells = (src: any) => {
          if (!src) return []
          if (Array.isArray(src)) return src
          if (src.bells && Array.isArray(src.bells)) return src.bells
          if (src.periods && Array.isArray(src.periods)) return src.periods
          if (src.day && src.day.bells && Array.isArray(src.day.bells)) return src.day.bells
          return []
        }
        const bellsArr = tryExtractBells(bj).length ? tryExtractBells(bj) : (tryExtractBells(fullR && fullR.json).length ? tryExtractBells(fullR.json) : tryExtractBells(dayR && dayR.json))
        if (!bellsArr || !bellsArr.length) return { schedules, sources }
        const bellLabelMap: Record<string, string> = { 'RC': 'Roll Call', 'R': 'Recess', 'MTL1': 'Lunch 1', 'MTL2': 'Lunch 2', 'MTL': 'Lunch', 'L': 'Lunch' }
        // if top-level day exists, map entire array to that bucket
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
          sources[target] = 'api'
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
            if (pattern.includes('mon') || pattern.includes('tue')) { schedules['Mon/Tues'].push(entry); sources['Mon/Tues'] = 'api' }
            else if (pattern.includes('wed') || pattern.includes('thu') || pattern.includes('thur')) { schedules['Wed/Thurs'].push(entry); sources['Wed/Thurs'] = 'api' }
            else if (pattern.includes('fri')) { schedules['Fri'].push(entry); sources['Fri'] = 'api' }
            else { schedules['Mon/Tues'].push(entry); if (sources['Mon/Tues'] === 'empty') sources['Mon/Tues'] = 'api' }
          }
        }
        return { schedules, sources }
      } catch (e) {
        return { schedules: { 'Mon/Tues': [], 'Wed/Thurs': [], Fri: [] }, sources: { 'Mon/Tues': 'empty', 'Wed/Thurs': 'empty', Fri: 'empty' } }
      }
    }
    const authError = responses.find((r: any) => r && (r.status === 401 || r.status === 403))
    if (authError) {
      const payload = authError.json ?? authError.text ?? authError.html ?? null
      // Try to salvage bell schedules from any available responses so clients
      // can still render breaks when the portal requires authentication.
      const { schedules: _schedules, sources: _sources } = buildBellSchedulesFromResponses(dayRes, fullRes, bellsRes)
      const maybeBellSchedules = (_schedules && (Object.values(_schedules).some((a: any) => Array.isArray(a) && a.length))) ? _schedules : undefined
      const maybeBellSources = (_sources && (Object.values(_sources).some((a: any) => a !== 'empty'))) ? _sources : undefined
      return NextResponse.json(
        {
          error: 'Unauthorized from SBHS timetable API',
          details: payload,
          bellTimes: maybeBellSchedules,
          bellTimesSources: maybeBellSources,
          diagnostics: {
            hasAccessToken: !!accessToken,
            forwardedCookies: incomingCookie ? true : false,
            hostTried: responses.map((r: any) => r?.status ?? null),
          },
        },
        { status: authError.status, headers: cacheHeaders(req) },
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
      const { schedules: _schedules, sources: _sources } = buildBellSchedulesFromResponses(dayRes, fullRes, bellsRes)
      const maybeBellSchedules = (_schedules && (Object.values(_schedules).some((a: any) => Array.isArray(a) && a.length))) ? _schedules : undefined
      const maybeBellSources = (_sources && (Object.values(_sources).some((a: any) => a !== 'empty'))) ? _sources : undefined
      return NextResponse.json(
        {
          error: 'SBHS timetable API reported an authorization problem',
          details: explicitError.json,
          bellTimes: maybeBellSchedules,
          bellTimesSources: maybeBellSources,
          diagnostics: {
            hasAccessToken: !!accessToken,
            forwardedCookies: incomingCookie ? true : false,
            hostTried: responses.map((r: any) => r?.status ?? null),
          },
        },
        { status: 401, headers: cacheHeaders(req) },
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
    // NOTE: byDay is already declared above - we extend it here, not replace

    // If full timetable exists, prefer it to populate multiple days
    if (fullRes && (fullRes as any).json) {
      const j = (fullRes as any).json
      const dayNames = Object.keys(byDay)
      const resolveDayKey = (input: any): string => {
        if (!input) return dayNames[requestedDayIndex] || 'Monday'
        const raw = typeof input === 'string' ? input : input.name || input.label || ''
        if (!raw) return dayNames[requestedDayIndex] || 'Monday'
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
        return dayNames[requestedDayIndex] || 'Monday'
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
    // BUT ONLY if we don't already have periods from the date-specific path
    if (dayRes && (dayRes as any).json) {
      const dj = (dayRes as any).json
      const dowDate = dateParam ? new Date(dateParam) : new Date()
      const dow = Number.isNaN(dowDate.getTime())
        ? requestedWeekdayString
        : dowDate.toLocaleDateString('en-US', { weekday: 'long' })
      
      // Skip if we already have periods for this day (from date-specific path)
      if (byDay[dow] && byDay[dow].length > 0) {
        console.log(`[API] Skipping dayRes merge - already have ${byDay[dow].length} periods for ${dow}`)
      } else {
        // Try to extract periods from dayRes
        let arr: any[] = Array.isArray(dj) ? dj : (dj.periods || dj.entries || dj.data || [])
        if (!Array.isArray(arr) && dj?.day?.periods) {
          arr = Array.isArray(dj.day.periods) ? dj.day.periods : extractPeriods(dj.day.periods) || []
        }
        if (!Array.isArray(arr) && dj?.timetable?.periods) {
          const extracted = extractPeriods(dj.timetable)
          if (extracted) arr = extracted
        }
        // Also try the correct SBHS path: timetable.timetable.periods
        if ((!Array.isArray(arr) || arr.length === 0) && dj?.timetable?.timetable?.periods) {
          const periodsObj = dj.timetable.timetable.periods
          if (periodsObj && typeof periodsObj === 'object') {
            arr = Object.entries(periodsObj).map(([key, val]) => ({ period: key, ...(val as any) }))
          }
        }
        if (!Array.isArray(arr)) arr = []
        
        if (arr.length > 0) {
          const inferred: WeekType | null = inferWeekType(dow, dj.dayInfo || dj.timetable || dj)
          if (inferred) detectedWeekType = inferred
          byDay[dow] = arr.map((entry: any) => toPeriod(entry, inferred))
          console.log(`[API] Merged ${arr.length} periods for ${dow} from dayRes`)
        }
      }
    }

    // Optionally refine times using bells
    if (fullRes && (fullRes as any).json) {
      const j = (fullRes as any).json
      const dayNames = Object.keys(byDay)
      const resolveDayKey = (input: any): string => {
        if (!input) return dayNames[requestedDayIndex] || 'Monday'
        const raw = typeof input === 'string' ? input : input.name || input.label || ''
        if (!raw) return dayNames[requestedDayIndex] || 'Monday'
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
        return dayNames[requestedDayIndex] || 'Monday'
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
      bellSchedules = schedules
      bellTimesSources = bellSources
      try {
        // Helpful debug output during development: show which buckets were
        // populated and whether a top-level day or upstream day bells were
        // observed. The client can then use this to verify API-derived
        // bell times aren't being discarded later in the fetch/retry flow.
        // Note: topLevelDayRaw and bellsArr are scoped inside the bell extraction block above
        console.debug('[timetable.route] bellTimesSources:', bellTimesSources)
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
    // But preserve Period 0, Roll Call, End of Day, and break periods
    const isSpecialPeriod = (p: any) => {
      const period = String(p.period || '').trim().toLowerCase()
      const subject = String(p.subject || '').trim().toLowerCase()
      // Period 0, Roll Call (RC), End of Day (EoD) should always be kept
      if (period === '0' || period === 'rc' || period === 'eod') return true
      if (subject.includes('period 0') || subject.includes('roll call') || subject.includes('end of day')) return true
      // Also keep breaks (Recess, Lunch)
      if (/(recess|lunch|break)/i.test(subject) || /(recess|lunch|break|^r$|^l\d?$|mtl|wfl)/i.test(period)) return true
      return false
    }
    for (const dayName of Object.keys(byDay)) {
      byDay[dayName] = byDay[dayName].filter(p => {
        // Always keep special periods (Period 0, RC, EoD, breaks)
        if (isSpecialPeriod(p)) return true
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
        if (!seen.has(key)) {
          // Create a clean copy WITHOUT date-specific flags like isRoomChange/displayRoom
          // or isSubstitute/casualSurname. The timetableByWeek represents the cycle/template
          // data, not date-specific variations. Date-specific info stays in byDay.
          const clean = { 
            ...p, 
            period, 
            time, 
            subject: subjectDisplay, 
            teacher: normalizeString(p.teacher), 
            fullTeacher: normalizeString(p.fullTeacher), 
            room: normalizeString(p.room), 
            weekType: weekTypeKey || undefined 
          }
          // Remove date-specific variation flags from the cycle view
          delete clean.isRoomChange
          delete clean.displayRoom
          delete clean.isSubstitute
          delete clean.casualSurname
          delete clean.casualToken
          delete clean.displayTeacher
          delete clean.originalTeacher
          seen.set(key, clean)
        }
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
      // Find max among A, B
      if (weekTally.A >= weekTally.B) {
        dominantWeekType = 'A'
      } else {
        dominantWeekType = 'B'
      }
      // If there's a tie and we have a detected week, prefer that
      if (weekTally.A === weekTally.B && detectedWeekType) {
        dominantWeekType = detectedWeekType
      }
    }

    // Prefer explicit upstream `weekType` when present on any of the
    // fetched JSON responses (day/full/bells). This ensures the portal's
    // canonical week marker takes precedence over heuristic inference.
    // NOTE: SBHS API returns weekType INSIDE dayInfo object, not at root
    const upstreamExplicitWeek = (
      // Check dayRes.json.dayInfo.weekType first (primary source)
      (dayRes && (dayRes as any).json?.dayInfo?.weekType) ||
      // Fallback to root level weekType
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
    
    // Declare variation debug vars outside try block for access in response
    let dayResDay: string | null = null
    let dayPeriodNumbers: string[] = []
    let variationsDiag: {
      appliedClassVars: Array<{period: string; teacher: string}>
      appliedRoomVars: Array<{period: string; room: string}>
      skippedClassVars: Array<{period: string; reason: string}>
      skippedRoomVars: Array<{period: string; reason: string}>
    } = {
      appliedClassVars: [],
      appliedRoomVars: [],
      skippedClassVars: [],
      skippedRoomVars: []
    }
    
    if (hasAny) {
      // Apply substitutions from upstream.day.classVariations directly to the timetable
      // BUT ONLY for the specific day AND week type that dayRes is for
      try {
        const dj = dayRes?.json
        if (!dj) throw new Error('No dayRes.json')
        
        // Extract the date from the dayRes response itself
        const dayDate = dj.date || dj.day?.date || dj.dayInfo?.date || dateParam
        
        // Extract the week type from the dayRes - CRITICAL for applying variations correctly
        // The dayname field like "MonB" contains both day and week info
        let dayResWeekType: string | null = null
        const dayname = dj.timetable?.timetable?.dayname || dj.timetable?.dayInfo?.dayName || dj.dayname || dj.dayName || dj.dayInfo?.dayName
        if (dayname && typeof dayname === 'string') {
          // Extract week letter from dayname like "MonA", "TueB", etc.
          const match = dayname.match(/[AB]$/i)
          if (match) {
            dayResWeekType = match[0].toUpperCase()
          }
        }
        // Also check explicit weekType fields
        if (!dayResWeekType) {
          const explicitWeekType = dj.timetable?.dayInfo?.weekType || dj.dayInfo?.weekType || dj.weekType
          if (explicitWeekType && /^[AB]$/i.test(String(explicitWeekType))) {
            dayResWeekType = String(explicitWeekType).toUpperCase()
          }
        }
        console.log(`[API] Variation week type: ${dayResWeekType || 'unknown'} (from dayname: ${dayname || 'none'})`)

        if (dayDate) {
          // Parse the date string (YYYY-MM-DD format)
          const parsed = new Date(dayDate)
          if (!Number.isNaN(parsed.getTime())) {
            dayResDay = parsed.toLocaleDateString('en-US', { weekday: 'long' })
          }
        }
        
        // Fallback: try to extract from day name fields
        if (!dayResDay) {
          if (dayname && typeof dayname === 'string') {
            // Could be "Monday", "MonA", "Mon", etc.
            const normalized = dayname.replace(/[^a-z]/gi, '').toLowerCase()
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
            const match = days.find(d => normalized.startsWith(d.substring(0, 3)))
            if (match) {
              dayResDay = match.charAt(0).toUpperCase() + match.slice(1)
            }
          }
        }
        
        // Fallback to today if we still can't determine
        if (!dayResDay) {
          const fallbackDate = dateParam ? new Date(dateParam) : new Date()
          dayResDay = fallbackDate.toLocaleDateString('en-US', { weekday: 'long' })
        }
        
        const classVars = dj.classVariations || {}
        const roomVars = dj.roomVariations || {}
        
        // Debug: capture all periods on the target day
        const dayPeriods = byDay[dayResDay] || []
        dayPeriodNumbers = dayPeriods.map((p: any) => String(p.period).trim())
        
        console.log(`[API] Applying substitutions for ${dayResDay} only (date: ${dayDate || 'unknown'})`)
        console.log(`[API] byDay[${dayResDay}] periods: [${dayPeriodNumbers.join(', ')}]`)
        console.log(`[API] classVars keys: [${Object.keys(classVars).join(', ')}]`)
        console.log(`[API] roomVars keys: [${Object.keys(roomVars).join(', ')}]`)
        
        // Apply class variations (teacher substitutions) - ONLY to dayResDay
        // IMPORTANT: classVariations is keyed by period number, e.g. {"1": {...}, "2": {...}}
        // The period key itself IS the period number - we need to iterate entries, not values
        if (!Array.isArray(classVars) && typeof classVars === 'object') {
          for (const [periodKey, v] of Object.entries(classVars)) {
            if (!v || typeof v !== 'object') {
              variationsDiag.skippedClassVars.push({ period: periodKey, reason: 'not an object' })
              continue
            }
            const vObj = v as any
            // Skip if type is 'novariation' (means no change)
            if (vObj.type === 'novariation') {
              variationsDiag.skippedClassVars.push({ period: periodKey, reason: 'type=novariation' })
              continue
            }
            
            const casualSurname = vObj.casualSurname ? String(vObj.casualSurname).trim() : ''
            const casualToken = vObj.casual ? String(vObj.casual).trim() : ''
            
            // For 'nocover' type, there's a sub but no casualSurname - use "No Cover"
            const displayTeacher = casualSurname || (vObj.type === 'nocover' ? 'No Cover' : '')
            
            if (!displayTeacher) {
              variationsDiag.skippedClassVars.push({ period: periodKey, reason: `no display teacher (type=${vObj.type})` })
              continue
            }
            
            // Apply ONLY to the specific day (dayResDay) AND matching week type
            let applied = false
            if (byDay[dayResDay]) {
              byDay[dayResDay].forEach((p: any) => {
                if (String(p.period).trim() === String(periodKey).trim()) {
                  // CRITICAL: Only apply to periods with matching week type
                  // If dayResWeekType is "B", only apply to periods with weekType "B" or undefined
                  // This prevents applying Mon B's substitute to Mon A's period
                  if (dayResWeekType && p.weekType && p.weekType !== dayResWeekType) {
                    console.log(`[API] ⏭️ Skipping P${periodKey} - week type mismatch: period is ${p.weekType}, variation is for ${dayResWeekType}`)
                    return // Don't mark as applied - might have another period with matching week
                  }
                  
                  // Skip if already has substitute applied (from date-specific path)
                  if (p.isSubstitute && p.casualSurname) {
                    console.log(`[API] ⏭️ Skipping P${periodKey} - already has substitute: ${p.casualSurname}`)
                    applied = true // Count as applied since it's already done
                    return
                  }
                  p.casualSurname = casualSurname || undefined
                  p.casualToken = casualToken || undefined
                  p.isSubstitute = true
                  p.originalTeacher = p.teacher
                  p.teacher = displayTeacher
                  p.displayTeacher = displayTeacher
                  console.log(`[API] ✅ Applied casual: ${dayResDay} P${periodKey} -> ${displayTeacher}`)
                  variationsDiag.appliedClassVars.push({ period: periodKey, teacher: displayTeacher })
                  applied = true
                }
              })
            }
            if (!applied) {
              variationsDiag.skippedClassVars.push({ period: periodKey, reason: `no matching period in byDay[${dayResDay}]` })
            }
          }
        }
        
        // Apply room variations - ONLY to dayResDay
        // IMPORTANT: roomVariations is keyed by period number, e.g. {"1": {roomTo: "203"}}
        if (!Array.isArray(roomVars) && typeof roomVars === 'object') {
          for (const [periodKey, v] of Object.entries(roomVars)) {
            if (!v || typeof v !== 'object') {
              variationsDiag.skippedRoomVars.push({ period: periodKey, reason: 'not an object' })
              continue
            }
            const vObj = v as any
            const newRoom = vObj.roomTo ? String(vObj.roomTo).trim() : ''
            
            if (!newRoom) {
              variationsDiag.skippedRoomVars.push({ period: periodKey, reason: 'no roomTo value' })
              continue
            }
            
            // Apply ONLY to the specific day AND matching week type
            let applied = false
            if (byDay[dayResDay]) {
              byDay[dayResDay].forEach((p: any) => {
                const pPeriod = String(p.period).trim()
                if (pPeriod === String(periodKey).trim()) {
                  // CRITICAL: Only apply to periods with matching week type
                  if (dayResWeekType && p.weekType && p.weekType !== dayResWeekType) {
                    console.log(`[API] ⏭️ Skipping P${periodKey} room change - week type mismatch: period is ${p.weekType}, variation is for ${dayResWeekType}`)
                    return
                  }
                  
                  // Skip if already has room change applied (from date-specific path)
                  if (p.isRoomChange && p.displayRoom) {
                    console.log(`[API] ⏭️ Skipping P${periodKey} room change - already has: ${p.displayRoom}`)
                    applied = true
                    return
                  }
                  
                  // Only apply if the new room actually differs from scheduled room
                  const currentRoom = String(p.room || '').trim()
                  if (newRoom.toLowerCase() === currentRoom.toLowerCase()) {
                    console.log(`[API] ⏭️ Skipping P${periodKey} room change - same as scheduled: ${currentRoom}`)
                    applied = true
                    return
                  }
                  
                  p.displayRoom = newRoom
                  p.isRoomChange = true
                  p.originalRoom = currentRoom // Preserve for UI
                  console.log(`[API] ✅ Applied room change: ${dayResDay} P${periodKey} ${currentRoom} -> ${newRoom}`)
                  variationsDiag.appliedRoomVars.push({ period: periodKey, room: newRoom })
                  applied = true
                }
              })
            }
            if (!applied) {
              variationsDiag.skippedRoomVars.push({ period: periodKey, reason: `no matching period in byDay[${dayResDay}]` })
            }
          }
        }
      } catch (e) {
        console.error('[API] Failed to apply substitutions:', e)
      }
      
      return NextResponse.json({
        timetable: byDay,
        timetableByWeek,
        bellTimes: typeof bellSchedules !== 'undefined' ? bellSchedules : undefined,
        bellTimesSources: typeof bellTimesSources !== 'undefined' ? bellTimesSources : undefined,
        source: 'sbhs-api',
        weekType: finalWeekType,
        subjects: (dayRes?.json?.timetable?.subjects) || (fullRes?.json?.timetable?.subjects) || undefined,
        diagnostics: {
          detectedWeekType: detectedWeekType ?? null,
          dominantWeekType: dominantWeekType ?? null,
          inferredWeekParityFallback: null,
          weekTally,
          perDayWeekCounts,
          weekBreakdown,
          // Variation application debug info
          variations: variationsDiag,
          variationTargetDay: dayResDay,
          variationPeriodNumbers: dayPeriodNumbers,
          // Include raw upstream payloads to help diagnose where A/B info may be present
          upstream: {
            day: dayRes?.json ?? null,
            full: fullRes?.json ?? null,
            bells: bellsRes?.json ?? null,
          }
        }
      }, { status: 200, headers: cacheHeaders(req) })
    }

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
      { status: 502, headers: cacheHeaders(req) },
    )
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', details: String(error) }, { status: 500, headers: cacheHeaders(req) })
  }
}
