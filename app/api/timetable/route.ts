import { NextRequest, NextResponse } from 'next/server';

type WeekType = 'A' | 'B' | 'C';

// Format casual teacher name like the competitor app does
// e.g. "smithj" -> "J Smith."
function formatCasual(casual?: string | null): string | null {
  if (!casual) return null;
  if (casual.length === 0) return casual;
  if (casual.length === 1) return `${casual.toUpperCase()}.`;
  
  // Last char is first initial, rest is surname
  // e.g. "likourezosv" -> "V Likourezos."
  return `${casual[casual.length - 1]?.toUpperCase()} ${casual[0]?.toUpperCase()}${casual.substring(1, casual.length - 1).toLowerCase()}.`;
}

// Parse weekType from various sources
function parseWeekType(value: any): WeekType | null {
  if (value == null) return null;
  const str = String(value).trim().toUpperCase();
  if (str === 'A' || str === 'B' || str === 'C') return str as WeekType;
  
  // Check for patterns like "MonA", "TueB", "WedC"
  const match = str.match(/^[A-Z]{3}([ABC])$/i);
  if (match && match[1]) return match[1].toUpperCase() as WeekType;
  
  return null;
}

// Period type matching frontend expectations
interface Period {
  period: string;
  time: string;
  subject: string;
  teacher: string;
  fullTeacher?: string;
  room: string;
  weekType?: WeekType;
  // Substitution fields
  casual?: string;
  casualSurname?: string;
  isSubstitute?: boolean;
  originalTeacher?: string;
  displayTeacher?: string;
  // Room change fields
  roomTo?: string;
  displayRoom?: string;
  isRoomChange?: boolean;
}

// Transform raw SBHS API period into our Period type
function toPeriod(
  bell: any,
  period: any,
  subject: any,
  classVariation: any,
  roomVariation: any,
  date: string,
  weekType: WeekType | null
): Period {
  const startTime = bell?.startTime || '';
  const endTime = bell?.endTime || '';
  const time = [startTime, endTime].filter(Boolean).join(' - ');
  
  // Build name from period data
  let name = bell?.bellDisplay || bell?.bell || '';
  let shortName = bell?.bell || '';
  
  if (period?.title) {
    name = period.title;
    if (period.year) {
      name = period.year + name;
      shortName = name;
      // Get full subject name from subjects map
      if (subject?.title) {
        name = subject.title;
      }
    }
  }
  
  const teacher = period?.fullTeacher || period?.teacher || '';
  const room = period?.room || '';
  
  // Apply class variations (substitutes)
  let casual: string | undefined;
  let casualSurname: string | undefined;
  let isSubstitute = false;
  let displayTeacher = teacher;
  
  if (classVariation && classVariation.type !== 'novariation') {
    casualSurname = classVariation.casualSurname || undefined;
    casual = classVariation.casualSurname 
      || formatCasual(classVariation.casual) 
      || 'No one';
    isSubstitute = true;
    displayTeacher = casualSurname || casual || teacher;
  }
  
  // Apply room variations
  let roomTo: string | undefined;
  let displayRoom = room;
  let isRoomChange = false;
  
  if (roomVariation?.roomTo) {
    roomTo = roomVariation.roomTo;
    displayRoom = roomTo;
    isRoomChange = true;
  }
  
  return {
    period: shortName,
    time,
    subject: name,
    teacher,
    fullTeacher: period?.fullTeacher || undefined,
    room,
    weekType: weekType || undefined,
    // Substitution fields
    ...(casual && { casual }),
    ...(casualSurname && { casualSurname }),
    ...(isSubstitute && { isSubstitute, originalTeacher: teacher, displayTeacher }),
    // Room change fields
    ...(roomTo && { roomTo }),
    ...(isRoomChange && { displayRoom, isRoomChange }),
  };
}

// Transform day timetable (daytimetable.json) response - applies substitutions
function transformDayTimetable(data: any): {
  periods: Period[];
  date: string;
  weekType: WeekType | null;
  classVariations: any;
  roomVariations: any;
} {
  const bells = data.bells || [];
  const timetable = data.timetable;
  const classVariations = !Array.isArray(data.classVariations) ? data.classVariations : {};
  const roomVariations = !Array.isArray(data.roomVariations) ? data.roomVariations : {};
  const date = data.date || '';
  
  // Get weekType from dayInfo
  const weekType = parseWeekType(data.dayInfo?.weekType) 
    || parseWeekType(data.timetable?.timetable?.dayname)
    || null;
  
  if (typeof timetable === 'boolean' || !timetable) {
    return { periods: [], date, weekType, classVariations, roomVariations };
  }
  
  const subjects = !Array.isArray(timetable.subjects) ? timetable.subjects : {};
  const periods = !Array.isArray(timetable.timetable?.periods) ? timetable.timetable?.periods : {};
  
  const result: Period[] = [];
  
  for (const bell of bells) {
    const periodKey = bell?.bell;
    const period = periods?.[periodKey];
    
    // Get subject info for color/full name
    let subjectInfo = null;
    if (period?.year && period?.title) {
      const subjectKey = period.year + period.title;
      subjectInfo = subjects?.[subjectKey];
    }
    
    // Get variations for this period
    const classVariation = classVariations?.[periodKey];
    const roomVariation = roomVariations?.[periodKey];
    
    result.push(toPeriod(bell, period, subjectInfo, classVariation, roomVariation, date, weekType));
  }
  
  return { periods: result, date, weekType, classVariations, roomVariations };
}

// Transform full timetable (timetable.json) response - NO substitutions
function transformFullTimetable(data: any): {
  days: Record<string, Period[]>;
  subjects: any[];
} {
  const days: Record<string, Period[]> = {};
  const subjects = data.subjects || [];
  const rawDays = data.days || {};
  
  for (const [dayNum, dayData] of Object.entries(rawDays)) {
    const day = dayData as any;
    const dayname = day.dayname || '';
    
    // Parse week from dayname (e.g., "MonA" -> weekType: "A")
    const weekType = parseWeekType(dayname);
    const dayOfWeek = dayname.substring(0, 3); // "Mon", "Tue", etc.
    
    // Map short day names to full names
    const dayMap: Record<string, string> = {
      'Mon': 'Monday',
      'Tue': 'Tuesday',
      'Wed': 'Wednesday',
      'Thu': 'Thursday',
      'Fri': 'Friday',
    };
    const fullDayName = dayMap[dayOfWeek] || dayOfWeek;
    
    const periods = day.periods || {};
    const routine = (day.routine || '').split(',');
    
    const periodList: Period[] = [];
    
    for (const [periodNum, periodData] of Object.entries(periods)) {
      const p = periodData as any;
      
      // Get subject info
      let subjectInfo = null;
      if (p.year && p.title) {
        const subjectKey = p.year + p.title;
        subjectInfo = subjects.find((s: any) => s.shortTitle === p.title);
      }
      
      periodList.push({
        period: periodNum,
        time: '', // Full timetable doesn't have specific times
        subject: p.title || '',
        teacher: p.fullTeacher || p.teacher || '',
        fullTeacher: p.fullTeacher || undefined,
        room: p.room || '',
        weekType: weekType || undefined,
      });
    }
    
    // Use dayname as key to preserve week info
    days[dayname] = periodList;
  }
  
  return { days, subjects };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get('date') || undefined;
  const accessToken = req.cookies.get('sbhs_access_token')?.value;
  const incomingCookie = req.headers.get('cookie') || '';

  const baseHeaders: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://student.sbhs.net.au/',
  };
  
  if (incomingCookie) baseHeaders['Cookie'] = incomingCookie;
  if (accessToken) baseHeaders['Authorization'] = `Bearer ${accessToken}`;

  // Helper to fetch from SBHS API
  async function fetchSBHS(endpoint: string, params?: Record<string, string>) {
    const hosts = ['https://student.sbhs.net.au', 'https://api.sbhs.net.au'];
    
    for (const host of hosts) {
      try {
        const fetchUrl = new URL(`/api/${endpoint}`, host);
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            fetchUrl.searchParams.set(k, v);
          }
        }
        
        const res = await fetch(fetchUrl.toString(), {
          headers: baseHeaders,
          credentials: 'include',
        });
        
        if (res.ok) {
          const json = await res.json();
          return { ok: true, json, status: res.status };
        }
      } catch (e) {
        continue;
      }
    }
    return { ok: false, json: null, status: 0 };
  }

  try {
    // Fetch day timetable (with substitutions)
    const dayParams = dateParam ? { date: dateParam } : undefined;
    const dayRes = await fetchSBHS('timetable/daytimetable.json', dayParams);
    
    // Fetch full timetable (cycle, no substitutions)
    const fullRes = await fetchSBHS('timetable/timetable.json');
    
    // Fetch bells
    const bellsRes = await fetchSBHS('timetable/bells.json', dayParams);

    // Transform the responses
    let dayTimetable = null;
    let fullTimetable = null;
    
    if (dayRes.ok && dayRes.json) {
      dayTimetable = transformDayTimetable(dayRes.json);
    }
    
    if (fullRes.ok && fullRes.json) {
      fullTimetable = transformFullTimetable(fullRes.json);
    }
    
    // Build response in the format the frontend expects
    // Group by weekday, applying substitutions only to the specific day
    const timetable: Record<string, Period[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
    };
    
    const timetableByWeek: Record<string, { A: Period[]; B: Period[]; C: Period[]; unknown: Period[] }> = {
      Monday: { A: [], B: [], C: [], unknown: [] },
      Tuesday: { A: [], B: [], C: [], unknown: [] },
      Wednesday: { A: [], B: [], C: [], unknown: [] },
      Thursday: { A: [], B: [], C: [], unknown: [] },
      Friday: { A: [], B: [], C: [], unknown: [] },
    };
    
    // Populate from full timetable (cycle)
    if (fullTimetable) {
      for (const [dayname, periods] of Object.entries(fullTimetable.days)) {
        const dayOfWeek = dayname.substring(0, 3);
        const dayMap: Record<string, string> = {
          'Mon': 'Monday',
          'Tue': 'Tuesday', 
          'Wed': 'Wednesday',
          'Thu': 'Thursday',
          'Fri': 'Friday',
        };
        const fullDayName = dayMap[dayOfWeek] || dayOfWeek;
        const weekType = parseWeekType(dayname);
        
        if (timetableByWeek[fullDayName]) {
          const bucket = weekType || 'unknown';
          timetableByWeek[fullDayName][bucket].push(...periods);
        }
      }
    }
    
    // For the current/requested day, use day timetable with substitutions
    if (dayTimetable && dayTimetable.periods.length > 0) {
      const requestedDate = dateParam ? new Date(dateParam) : new Date();
      const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      // Filter to only real periods (not transitions, breaks, etc.)
      const realPeriods = dayTimetable.periods.filter(p => {
        const periodNum = parseInt(p.period, 10);
        return !isNaN(periodNum) && periodNum >= 0 && periodNum <= 5;
      });
      
      if (timetable[dayOfWeek]) {
        timetable[dayOfWeek] = realPeriods;
      }
      
      // Also update the week-specific view
      if (timetableByWeek[dayOfWeek] && dayTimetable.weekType) {
        timetableByWeek[dayOfWeek][dayTimetable.weekType] = realPeriods;
      }
    }
    
    // Fill in timetable from timetableByWeek using current week type
    const currentWeekType = dayTimetable?.weekType || null;
    for (const day of Object.keys(timetable)) {
      if (timetable[day].length === 0 && timetableByWeek[day]) {
        // Use the current week's data, or fall back to any available
        if (currentWeekType && timetableByWeek[day][currentWeekType]?.length > 0) {
          timetable[day] = timetableByWeek[day][currentWeekType];
        } else if (timetableByWeek[day].A?.length > 0) {
          timetable[day] = timetableByWeek[day].A;
        } else if (timetableByWeek[day].B?.length > 0) {
          timetable[day] = timetableByWeek[day].B;
        } else if (timetableByWeek[day].C?.length > 0) {
          timetable[day] = timetableByWeek[day].C;
        } else if (timetableByWeek[day].unknown?.length > 0) {
          timetable[day] = timetableByWeek[day].unknown;
        }
      }
    }

    // Build bell times in the format the frontend expects
    // Format: { 'Mon/Tues': [...], 'Wed/Thurs': [...], 'Fri': [...] }
    const bellTimes: Record<string, { period: string; time: string }[]> = {
      'Mon/Tues': [],
      'Wed/Thurs': [],
      'Fri': [],
    };
    
    // Get bells from day response or bells response
    const rawBells = dayRes.json?.bells || bellsRes.json?.bells || bellsRes.json || [];
    if (Array.isArray(rawBells)) {
      const requestedDate = dateParam ? new Date(dateParam) : new Date();
      const dayOfWeek = requestedDate.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri
      
      // Determine which bucket this day belongs to
      let bucket: string;
      if (dayOfWeek === 5) {
        bucket = 'Fri';
      } else if (dayOfWeek === 3 || dayOfWeek === 4) {
        bucket = 'Wed/Thurs';
      } else {
        bucket = 'Mon/Tues';
      }
      
      const formatted = rawBells.map((b: any) => ({
        period: b.bellDisplay || b.period || b.bell || '',
        time: [b.startTime, b.endTime].filter(Boolean).join(' - '),
      }));
      
      bellTimes[bucket] = formatted;
    }

    return NextResponse.json({
      timetable,
      timetableByWeek,
      weekType: dayTimetable?.weekType || null,
      bellTimes,
      source: 'sbhs-api',
      // Include raw upstream data for debugging
      upstream: {
        day: dayRes.json,
        full: fullRes.json,
        bells: bellsRes.json,
      },
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timetable', details: String(error) },
      { status: 500 }
    );
  }
}
