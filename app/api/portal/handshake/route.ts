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

    // 1) GET login page to pick up flowid and any Set-Cookie
    const loginUrl = 'https://student.sbhs.net.au/auth/login'
    const getRes = await fetch(loginUrl, { headers: { ...HEADERS, Cookie: incomingCookies } })
    const loginHtml = await getRes.text()

    // extract hidden flowid value if present
    const m = loginHtml.match(/name="flowid"\s+value="([^"]+)"/i) || loginHtml.match(/name='flowid'\s+value='([^']+)'/i)
    const flowid = m ? m[1] : null

    // collect any Set-Cookie from the GET
    const setCookieGet = getRes.headers.get('set-cookie') || null

    // 2) POST status to trigger server-side session handling
    const postUrl = 'https://student.sbhs.net.au/auth/login/_default'
    const form = new URLSearchParams()
    form.set('action', 'status')
    if (flowid) form.set('flowid', flowid)

    const postRes = await fetch(postUrl, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: [setCookieGet, incomingCookies].filter(Boolean).join('; '),
      },
      body: form.toString(),
      redirect: 'manual',
    })

    const postText = await postRes.text()
    const setCookiePost = postRes.headers.get('set-cookie') || null

    // Prepare forwarded Set-Cookie for the client (strip Domain)
    const forwardedCookies: string[] = []
    if (setCookieGet) forwardedCookies.push(stripDomain(setCookieGet))
    if (setCookiePost) forwardedCookies.push(stripDomain(setCookiePost))

    // 3) Re-probe key endpoints using the combination of incoming cookies + any cookies we got from portal
    const combinedCookieHeader = forwardedCookies.concat(incomingCookies ? [incomingCookies] : []).join('; ')
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
      setCookieGet: setCookieGet ? stripDomain(setCookieGet) : null,
      setCookiePost: setCookiePost ? stripDomain(setCookiePost) : null,
      probeResults,
    }

    // Build response and set cookies via the NextResponse cookies API (one-by-one)
    const res = NextResponse.json(respBody, { status: 200 })
    try {
      for (const c of forwardedCookies) {
        // c is like 'NAME=VALUE; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=3600; Expires=...'
        const parts = c.split(/;\s*/)
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
            if (!isNaN(dt.getTime())) opts.expires = dt.toUTCString()
          }
        }
        try {
          // Some runtimes expose res.cookies.set(name, value, opts)
          // Use that API to set the cookie on the response
          // @ts-ignore allow dynamic call
          if (typeof (res as any).cookies?.set === 'function') {
            ;(res as any).cookies.set(name, value, opts)
          }
        } catch (e) {
          // ignore cookie set errors; still return diagnostic info
          console.warn('Failed to set forwarded cookie', name, e)
        }
      }
    } catch (e) {
      // swallow
    }

    return res
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
