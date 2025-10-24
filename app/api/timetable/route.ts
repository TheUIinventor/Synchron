import { NextRequest, NextResponse } from 'next/server';

// This route proxies requests to the SBHS Timetable API, including cookies for authentication.
export async function GET(req: NextRequest) {
  const apiUrl = 'https://student.sbhs.net.au/api/timetable/v1/info.json';
  const accessToken = req.cookies.get('sbhs_access_token')?.value
  const refreshToken = req.cookies.get('sbhs_refresh_token')?.value
  // We'll try multiple strategies: 1) authenticated JSON endpoint using tokens,
  // 2) public bells/timetable endpoints scraped as JSON, 3) bundled sample fallback.

  try {
    const headers: Record<string,string> = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://student.sbhs.net.au/',
    }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const cookieParts: string[] = []
    if (accessToken) cookieParts.push(`sbhs_access_token=${accessToken}`)
    if (refreshToken) cookieParts.push(`sbhs_refresh_token=${refreshToken}`)
    if (cookieParts.length) headers['Cookie'] = cookieParts.join('; ')

    // Try authenticated endpoint first if tokens exist
    if (accessToken || refreshToken) {
      const response = await fetch(apiUrl, { headers })
      const text = await response.text()
      if (response.ok) {
        try {
          const data = JSON.parse(text)
          // forward Set-Cookie if present
          const sc = response.headers.get('set-cookie')
          if (sc) {
            const forwarded = sc.replace(/;\s*Domain=[^;]+/gi, '')
            return NextResponse.json(data, { headers: { 'set-cookie': forwarded } })
          }
          return NextResponse.json(data)
        } catch (e) {
          // fallthrough to other strategies
        }
      }
      // If authenticated endpoint returned HTML or failed to parse, fall through
    }

    // 2) Try public endpoints used by other timetable apps (bells / day timetable)
    // We'll attempt the public paths and try to parse JSON or extract useful data.
    const publicPaths = [
      'https://student.sbhs.net.au/api/timetable/bells.json',
      'https://student.sbhs.net.au/api/timetable/daytimetable.json',
      'https://student.sbhs.net.au/timetable/timetable.json',
    ]
    for (const p of publicPaths) {
      try {
        const r = await fetch(p, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } })
        if (!r.ok) continue
        const t = await r.text()
        try {
          const data = JSON.parse(t)
          return NextResponse.json({ ...data, source: 'public:' + p })
        } catch (e) {
          // if text looks like HTML, skip
          if (t && t.trim().startsWith('<')) continue
        }
      } catch (e) {
        // ignore and try next
      }
    }

    // 3) No live data available from the portal APIs
    return NextResponse.json({ error: 'No timetable data available from SBHS API', probeTried: publicPaths }, { status: 502 })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', details: String(error) }, { status: 500 });
  }
}
