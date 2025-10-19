import { NextResponse } from 'next/server'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': 'https://student.sbhs.net.au/',
}

function stripDomain(setCookie: string) {
  return setCookie.replace(/;\s*Domain=[^;]+/gi, '')
}

export async function POST(req: Request) {
  try {
    // forward any cookies the browser sent
    const incomingCookies = req.headers.get('cookie') || ''

    // 1) perform an initial GET and then follow up to N redirects manually
    const loginUrl = 'https://student.sbhs.net.au/auth/login'
    const maxHops = 6
    const collectedSetCookies: string[] = []
    const locations: string[] = []
    let bodyText: string | null = null
    let flowid: string | null = null

    // start with initial request (include any browser cookies)
    let curUrl: string | null = loginUrl
    let curCookieHeader = incomingCookies || ''
    for (let hop = 0; hop < maxHops && curUrl; hop++) {
      const r: Response = await fetch(curUrl, { headers: { ...HEADERS, Cookie: curCookieHeader }, redirect: 'manual' })
      const sc: string | null = r.headers.get('set-cookie')
      if (sc) {
        // split possible combined string into individual cookies
        const parts: string[] = sc.split(/,(?=[^ ;]+=)/g).map((s: string) => s.trim()).filter(Boolean)
        for (const p of parts) collectedSetCookies.push(p)
      }
      const loc: string | null = r.headers.get('location')
      if (loc) locations.push(loc)

      // capture body for flowid extraction on first hop
      if (hop === 0) {
        try { bodyText = await r.text() } catch (e) { bodyText = null }
        // extract flowid from HTML if present
        const m = bodyText ? (bodyText.match(/name="flowid"\s+value="([^"]+)"/i) || bodyText.match(/name='flowid'\s+value='([^']+)'/i)) : null
        flowid = m ? m[1] : null
      }

      // prepare next URL: if location is absolute or relative
      if (loc) {
        try {
          // resolve relative locations against current
          curUrl = new URL(loc, curUrl).toString()
          // update cookie header with collected cookies so far
          curCookieHeader = collectedSetCookies.map(stripDomain).map((s: string) => s.split(/;\s*/)[0]).filter(Boolean).join('; ')
        } catch (e) {
          curUrl = null
        }
      } else {
        curUrl = null
      }
    }

    // 2) Prepare forwarded Set-Cookie values (strip Domain) and compute combined Cookie header
    const forwardedCookies: string[] = collectedSetCookies.map(stripDomain)
    const combinedCookieHeader = forwardedCookies.map(s => s.split(/;\s*/)[0]).filter(Boolean).concat(incomingCookies ? [incomingCookies] : []).join('; ')
    const probePaths = ['/details/userinfo.json', '/notices', '/awards', '/timetable']
    const probeResults: Record<string, any> = {}
    await Promise.all(probePaths.map(async (pp) => {
      try {
        const url = `https://student.sbhs.net.au${pp}`
        const r = await fetch(url, { headers: { ...HEADERS, Cookie: combinedCookieHeader } })
        const ct = r.headers.get('content-type') || ''
        let snippet = null
        try { snippet = (await r.text()).slice(0, 4096) } catch (e) { snippet = String(e) }
        probeResults[pp] = { ok: r.ok, status: r.status, contentType: ct, snippet }
      } catch (e) {
        probeResults[pp] = { error: String(e) }
      }
    }))

    const respBody: any = {
      ok: true,
      flowid: flowid ?? null,
      locations,
      collectedSetCookies: collectedSetCookies.map(s => stripDomain(s)),
      probeResults,
    }

    // Build response and set cookies via the NextResponse cookies API (one-by-one)
    const res = NextResponse.json(respBody, { status: 200 })
    try {
      // set each collected cookie on the response
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
        try {
          // @ts-ignore
          if (typeof (res as any).cookies?.set === 'function') {
            ;(res as any).cookies.set(name, value, opts)
          }
        } catch (e) {
          console.warn('Failed to set forwarded cookie', name, e)
        }
      }
    } catch (e) {
      // ignore
    }

    return res
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
