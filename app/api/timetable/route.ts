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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://student.sbhs.net.au/',
      'Accept-Language': 'en-US,en;q=0.9',
    }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const cookieParts: string[] = []
    if (accessToken) cookieParts.push(`sbhs_access_token=${accessToken}`)
    if (refreshToken) cookieParts.push(`sbhs_refresh_token=${refreshToken}`)
    if (cookieParts.length) headers['Cookie'] = cookieParts.join('; ')

    // Helper to parse and collect Set-Cookie strings
    const collectSetCookie = (hdr: string | null, out: string[]) => {
      if (!hdr) return
      // split on comma where new cookie starts (naive but works for common cases)
      const parts = hdr.split(/,(?=[^ ;]+=)/g).map(s => s.trim()).filter(Boolean)
      for (const p of parts) out.push(p)
    }

    // Build initial cookie header from incoming request cookies and tokens
    const incomingCookies = req.headers.get('cookie') || ''
    const tokenCookieParts: string[] = []
    if (accessToken) tokenCookieParts.push(`sbhs_access_token=${accessToken}`)
    if (refreshToken) tokenCookieParts.push(`sbhs_refresh_token=${refreshToken}`)
    const tokenCookieHeader = tokenCookieParts.join('; ')
    const initialCookieHeader = [tokenCookieHeader, incomingCookies].filter(Boolean).join('; ')

    // Try authenticated endpoint first if tokens or cookies exist
    const tryFetchApi = async (cookieHeader: string) => {
      const h = { ...headers } as Record<string,string>
      if (cookieHeader) h['Cookie'] = cookieHeader
      if (accessToken) h['Authorization'] = `Bearer ${accessToken}`
      const response = await fetch(apiUrl, { headers: h, redirect: 'manual' })
      const ct = response.headers.get('content-type') || ''
      const text = await response.text()
      if (response.ok && ct.includes('application/json')) {
        try {
          const data = JSON.parse(text)
          return { ok: true, data, response }
        } catch (e) {
          return { ok: false, reason: 'invalid-json', text, response }
        }
      }
      return { ok: false, reason: 'non-json', text, response }
    }

    // First attempt using incoming cookies/tokens
    let attempt = await tryFetchApi(initialCookieHeader)

    // If we got non-json (likely HTML login), attempt a server-side handshake to collect cookies
    if (!attempt.ok) {
      try {
        const collectedSetCookies: string[] = []
        const locations: string[] = []

        // 1) GET login page and follow redirects manually to collect cookies
        const loginUrl = 'https://student.sbhs.net.au/auth/login'
        let curUrl: string | null = loginUrl
        let curCookieHeader = initialCookieHeader
        const maxHops = 6
        for (let hop = 0; hop < maxHops && curUrl; hop++) {
          const r = await fetch(curUrl, { headers: { ...headers, Cookie: curCookieHeader }, redirect: 'manual' })
          collectSetCookie(r.headers.get('set-cookie'), collectedSetCookies)
          const loc = r.headers.get('location')
          if (loc) locations.push(loc)
          // update cookie header
          curCookieHeader = collectedSetCookies.map(s => s.replace(/;\s*Domain=[^;]+/gi, '')).map(s => s.split(/;\s*/)[0]).filter(Boolean).join('; ')
          if (loc) {
            try { curUrl = new URL(loc, curUrl).toString() } catch (e) { curUrl = null }
          } else {
            curUrl = null
          }
        }

        // 2) POST status to attempt server-side session completion (if flowid present)
        // We try a POST to the _default status endpoint to encourage server set-cookie behavior
        const postUrl = 'https://student.sbhs.net.au/auth/login/_default'
        const form = new URLSearchParams()
        form.set('action', 'status')
        // attempt to extract flowid from first login GET body if needed (best-effort)
        // (we avoid reading large bodies here for performance)
        try {
          const getRes = await fetch(loginUrl, { headers: { ...headers, Cookie: initialCookieHeader } })
          const loginHtml = await getRes.text()
          const m = loginHtml.match(/name="flowid"\s+value="([^"]+)"/i) || loginHtml.match(/name='flowid'\s+value='([^']+)'/i)
          if (m) form.set('flowid', m[1])
        } catch (e) {
          // ignore
        }

        const postRes = await fetch(postUrl, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: [initialCookieHeader].filter(Boolean).join('; ') },
          body: form.toString(),
          redirect: 'manual'
        })
        collectSetCookie(postRes.headers.get('set-cookie'), collectedSetCookies)
        const postLoc = postRes.headers.get('location')
        if (postLoc) locations.push(postLoc)

        // 3) Follow captured locations to collect any additional cookies
        let followCookieHeader = collectedSetCookies.map(s => s.replace(/;\s*Domain=[^;]+/gi, '')).map(s => s.split(/;\s*/)[0]).filter(Boolean).join('; ')
        for (const loc of locations.slice(0, 6)) {
          try {
            const url = new URL(loc, loginUrl).toString()
            const r = await fetch(url, { headers: { ...headers, Cookie: [followCookieHeader, initialCookieHeader].filter(Boolean).join('; ') }, redirect: 'manual' })
            collectSetCookie(r.headers.get('set-cookie'), collectedSetCookies)
            const nxt = r.headers.get('location')
            if (nxt) locations.push(nxt)
            followCookieHeader = collectedSetCookies.map(s => s.replace(/;\s*Domain=[^;]+/gi, '')).map(s => s.split(/;\s*/)[0]).filter(Boolean).join('; '
            )
          } catch (e) {
            // ignore per-location errors
          }
        }

        // 4) Prepare forwarded cookies and try the API again using them
        const forwardedCookies = collectedSetCookies.map(s => s.replace(/;\s*Domain=[^;]+/gi, ''))
        const combinedCookieHeader = forwardedCookies.map(s => s.split(/;\s*/)[0]).filter(Boolean).concat(initialCookieHeader ? [initialCookieHeader] : []).join('; ')
        // Reattempt API fetch with combinedCookieHeader
        attempt = await tryFetchApi(combinedCookieHeader)

        // If attempt succeeded, build response and set cookies on the NextResponse
        if (attempt.ok) {
          const resBody = attempt.data
          const res = NextResponse.json(resBody, { status: 200 })
          try {
            for (const raw of forwardedCookies) {
              const parts = raw.split(/;\s*/)
              const [nameValue, ...attrs] = parts
              const eq = nameValue.indexOf('=')
              if (eq === -1) continue
              const name = nameValue.slice(0, eq)
              const value = nameValue.slice(eq + 1)
              const opts: any = { path: '/' }
              for (const a of attrs) {
                const la = a.toLowerCase()
                if (la === 'httponly') opts.httpOnly = true
                else if (la === 'secure') opts.secure = true
                else if (la.startsWith('samesite=')) opts.sameSite = a.split('=')[1]
                else if (la.startsWith('path=')) opts.path = a.split('=')[1]
                else if (la.startsWith('max-age=')) opts.maxAge = parseInt(a.split('=')[1], 10)
                else if (la.startsWith('expires=')) {
                  const dt = new Date(a.split('=')[1])
                  if (!isNaN(dt.getTime())) opts.expires = dt
                }
              }
              try { (res as any).cookies?.set(name, value, opts) } catch (e) { }
            }
          } catch (e) { }
          return res
        }
      } catch (e) {
        // ignore handshake errors and fall through to public attempts
      }
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
