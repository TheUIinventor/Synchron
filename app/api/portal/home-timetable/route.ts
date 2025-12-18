import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => {
  try { const hasCookie = req && req.headers && typeof req.headers.get === 'function' && Boolean(req.headers.get('cookie')); return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE } } catch (e) { return { 'Cache-Control': SHARED_CACHE } }
}

// Fetch the SBHS portal homepage with forwarded cookies and scrape the on-page timetable into JSON
export async function GET(req: NextRequest) {
  const incomingCookie = req.headers.get('cookie') || ''
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://student.sbhs.net.au/',
  }
  if (incomingCookie) headers['Cookie'] = incomingCookie

  try {
    // Follow redirects up to a small limit
    let nextUrl = 'https://student.sbhs.net.au/'
    let res: Response | null = null
    for (let i = 0; i < 6; i++) {
      res = await fetch(nextUrl, { headers, redirect: 'manual' })
      const status = res.status
      if ([301,302,303,307,308].includes(status)) {
        const loc = res.headers.get('location')
        if (loc) {
          try { nextUrl = new URL(loc, nextUrl).toString() } catch { nextUrl = loc }
          continue
        }
      }
      break
    }
    if (!res) return NextResponse.json({ error: 'No response from portal' }, { status: 502, headers: cacheHeaders(req) })

    const html = await res.text()
    const ctype = res.headers.get('content-type') || ''

    // If we received HTML, attempt to scrape timetable table(s)
    if (html && /<html/i.test(html)) {
      // Load cheerio dynamically to avoid build-time type resolution issues
      const cheerioMod: any = await import('cheerio')
      const $ = cheerioMod.load(html)

      // Try common selectors for the timetable
      const candidates = [
        'table.timetable',
        'table[id*="timetable"]',
        'table[class*="timetable"]',
        '.timetable table',
        'table[class*="schedule"]',
        '#timetable table',
        'table'
      ]

      // Helper: parse a generic timetable-like table into an array of period objects
      const parseTable = (table: any) => {
        const rows = table.find('tr')
        const out: any[] = []
        rows.each((i: number, el: any) => {
          if (i === 0) return // skip header
          const cells = $(el).find('td, th').map((_: any, c: any) => $(c).text().trim()).get()
          if (cells.length >= 3) {
            out.push({
              period: cells[0] || '',
              time: cells[1] || '',
              subject: cells[2] || '',
              teacher: cells[3] || '',
              room: cells[4] || '',
            })
          }
        })
        return out
      }

      // Strategy 1: Day headings then immediate table
      const byDay: Record<string, any[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
      const dayNames = Object.keys(byDay)
      $('h1,h2,h3,h4').each((_: any, h: any) => {
        const t = $(h).text().trim()
        const day = dayNames.find(d => t.toLowerCase().includes(d.toLowerCase()))
        if (day) {
          // find next table sibling or in the next few siblings
          let next = $(h).next()
          for (let i = 0; i < 5 && next.length; i++) {
            if (next.is('table')) {
              const items = parseTable(next)
              if (items.length) byDay[day] = items
              break
            }
            next = next.next()
          }
        }
      })

      // Strategy 2: a single timetable table
      const anyData = Object.values(byDay).some(a => a.length)
      if (!anyData) {
        for (const sel of candidates) {
          const table = $(sel).first()
          if (table && table.length) {
            const items = parseTable(table)
            if (items.length) {
              // Assign to current weekday
              const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' })
              byDay[weekday] = items
              break
            }
          }
        }
      }

      const has = Object.values(byDay).some(a => a.length)
        // Try to augment the scraped timetable with an API-derived weekType
        let weekType: string | null = null
        try {
          const headersForApi: Record<string, string> = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
          if (incomingCookie) headersForApi['Cookie'] = incomingCookie
          const hosts = ['https://student.sbhs.net.au', 'https://api.sbhs.net.au']
          for (const host of hosts) {
            try {
              const dr = await fetch(`${host}/api/timetable/daytimetable.json`, { headers: headersForApi })
              const fr = await fetch(`${host}/api/timetable/timetable.json`, { headers: headersForApi })
              const candidate = (await (dr.ok ? dr.json().catch(() => null) : Promise.resolve(null))) || (await (fr.ok ? fr.json().catch(() => null) : Promise.resolve(null)))
              if (candidate && typeof candidate === 'object') {
                const maybe = (candidate.weekType || candidate.week || candidate.week_label || candidate.cycle || candidate.rotation || candidate.weekLabel || candidate.week_type)
                if (maybe) {
                  const s = String(maybe).trim().toUpperCase()
                  if (s === 'A' || s === 'B') { weekType = s; break }
                  const m = s.match(/\b([AB])\b/)
                  if (m && m[1]) { weekType = m[1]; break }
                }
              }
            } catch (e) { /* ignore host errors */ }
          }
        } catch (e) { /* ignore api augmentation errors */ }
      
        // If API calendar marks today as a holiday, suppress portal timetable output
        try {
          const headersForApi: Record<string, string> = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
          if (incomingCookie) headersForApi['Cookie'] = incomingCookie
          const hosts = ['https://student.sbhs.net.au', 'https://api.sbhs.net.au']
          const today = new Date().toISOString().slice(0, 10)
          for (const host of hosts) {
            try {
              const url = `${host}/api/calendar/days.json?from=${today}&to=${today}`
              const dr = await fetch(url, { headers: headersForApi })
              if (!dr.ok) continue
              const days = await dr.json().catch(() => null)
              if (!days) continue
              const day = days[today] ?? (Array.isArray(days) && days[0]) ?? null
              const checkHoliday = (d: any) => {
                if (!d || typeof d !== 'object') return false
                if ('isHoliday' in d) return !!d.isHoliday
                if ('holiday' in d) {
                  const v = d.holiday
                  if (typeof v === 'boolean') return v
                  if (typeof v === 'string') return /holiday/i.test(v)
                }
                if ('is_school_day' in d) return !d.is_school_day
                if ('isSchoolDay' in d) return !d.isSchoolDay
                if ('status' in d && typeof d.status === 'string') if (/holiday|public/i.test(d.status)) return true
                if ('type' in d && typeof d.type === 'string') if (/holiday|public/i.test(d.type)) return true
                if ('dayType' in d && typeof d.dayType === 'string') if (/holiday/i.test(d.dayType)) return true
                return false
              }
              if (checkHoliday(day)) {
                return NextResponse.json({ timetable: {}, source: 'portal-home', weekType: weekType ?? undefined, holiday: true }, { headers: cacheHeaders(req) })
              }
            } catch (e) { /* ignore individual host errors */ }
          }
        } catch (e) { /* ignore calendar check errors */ }

      if (has) return NextResponse.json({ timetable: byDay, source: 'portal-home', weekType: weekType ?? undefined }, { headers: cacheHeaders(req) })

      // If no timetable found, forward the HTML for client-side handling
      return new NextResponse(html, { headers: Object.assign({}, { 'content-type': ctype || 'text/html; charset=utf-8' }, cacheHeaders(req)), status: res.status })
    }

    // Non-HTML: just forward status
    return NextResponse.json({ error: 'Unexpected portal response type', contentType: ctype }, { status: 502, headers: cacheHeaders(req) })
  } catch (err) {
    return NextResponse.json({ error: 'Portal fetch error', details: String(err) }, { status: 500, headers: cacheHeaders(req) })
  }
}
