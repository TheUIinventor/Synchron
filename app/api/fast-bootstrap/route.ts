import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const cacheHeaders = () => {
  return { 'Cache-Control': 'private, max-age=0, must-revalidate' }
}

/**
 * Fast Bootstrap endpoint - returns ONLY critical data needed for instant UI render
 * Fetches in parallel: just timetable for today + userinfo (auth check)
 * Ignores: calendar, awards, notices (loaded lazy)
 * Target: < 5 seconds for most cases
 */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('sbhs_access_token')?.value
  const incomingCookie = req.headers.get('cookie') || ''

  const baseHeaders: Record<string, string> = {
    'Accept': 'application/json, text/javascript, */*; q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://student.sbhs.net.au/',
    'Origin': 'https://student.sbhs.net.au',
    'Accept-Language': 'en-AU,en;q=0.9',
  }
  if (incomingCookie) baseHeaders['Cookie'] = incomingCookie
  if (accessToken) baseHeaders['Authorization'] = `Bearer ${accessToken}`

  async function fetchJson(url: string) {
    try {
      const res = await Promise.race([
        fetch(url, { headers: baseHeaders }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      ]) as Response
      
      if (!res.ok) return null
      const text = await res.text()
      const ctype = res.headers.get('content-type') || ''
      if (ctype.includes('application/json')) {
        try { return JSON.parse(text) } catch { return null }
      }
      return null
    } catch (e) {
      return null
    }
  }

  const now = new Date()
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`

  // Fetch ONLY timetable + minimal userinfo in parallel
  const [timetable] = await Promise.all([
    fetchJson(`https://api.sbhs.net.au/api/timetable/daytimetable.json?date=${dateStr}`)
      .catch(() => null)
      .then(v => v || fetchJson(`https://student.sbhs.net.au/api/timetable/daytimetable.json?date=${dateStr}`))
  ])

  return NextResponse.json(
    {
      timetable,
      success: !!timetable,
      timestamp: Date.now()
    },
    { headers: cacheHeaders() }
  )
}
