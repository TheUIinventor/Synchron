import { NextRequest, NextResponse } from 'next/server'

// Proxy the SBHS portal userinfo endpoint server-side to avoid CORS issues
export async function GET(req: NextRequest) {
  const apiUrl = 'https://student.sbhs.net.au/details/userinfo.json'
  const accessToken = req.cookies.get('sbhs_access_token')?.value
  const refreshToken = req.cookies.get('sbhs_refresh_token')?.value

  // If no access token, return 401 to signal signed-out; client will attempt refresh
  if (!accessToken && !refreshToken) {
    return NextResponse.json({ success: false, error: 'Missing SBHS access token' }, { status: 401 })
  }
  try {
    // Build headers: include Authorization when we have a bearer token and also forward cookies
    const headers: Record<string,string> = {
      'Accept': 'application/json',
      // Add common browser headers to avoid portal returning HTML for programmatic requests
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://student.sbhs.net.au/',
      'Origin': 'https://student.sbhs.net.au',
      'Accept-Language': 'en-AU,en;q=0.9',
    }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    // Diagnostic: masked Authorization token value for debugging
    const authHeader = headers['Authorization']
    const maskedAuth = authHeader ? (() => {
      try {
        const parts = authHeader.split(' ')
        const token = parts[1] || ''
        if (token.length <= 8) return `${parts[0]} ${'*'.repeat(token.length)}`
        return `${parts[0]} ${token.slice(0,4)}…${token.slice(-4)}`
      } catch (e) { return '[masked]' }
    })() : null

    // Forward SBHS cookies as a Cookie header so endpoints expecting cookie-based sessions work.
    // Prefer forwarding the incoming Cookie header (this ensures portal session cookies like
    // SHSIDP-S / SHPSID / SHSSAMLS are preserved). Fall back to just access/refresh tokens.
    const incomingCookieHeader = req.headers.get('cookie')
    if (incomingCookieHeader) {
      headers['Cookie'] = incomingCookieHeader
    } else {
      const cookieParts: string[] = []
      if (accessToken) cookieParts.push(`sbhs_access_token=${accessToken}`)
      if (refreshToken) cookieParts.push(`sbhs_refresh_token=${refreshToken}`)
      if (cookieParts.length > 0) headers['Cookie'] = cookieParts.join('; ')
    }

    // Forward a small whitelist of incoming browser headers so the portal
    // treats this request like it came from a browser. Do NOT forward
    // sensitive headers beyond what the browser sent; Cookie and Authorization
    // are already handled above.
    const headerWhitelist = [
      'user-agent',
      'accept',
      'accept-language',
      'referer',
      'x-requested-with',
      'sec-fetch-site',
      'sec-fetch-mode',
      'sec-fetch-dest',
      'sec-fetch-user'
    ]
    try {
      for (const h of headerWhitelist) {
        const val = req.headers.get(h)
        if (val) headers[h] = val
      }
    } catch (e) {
      // ignore header-copy failures
    }

    const response = await fetch(apiUrl, {
      headers,
    })

    const text = await response.text()
      // Collect a small set of response headers for diagnostics
      const hdr = (name: string) => response.headers.get(name)
      const respHeaders: Record<string,string> = {}
      const interesting = ['content-type', 'set-cookie', 'location', 'www-authenticate', 'cache-control']
      for (const h of interesting) {
        const v = hdr(h)
        if (v) respHeaders[h] = v
      }

      // Masked view of incoming cookies for diagnostics (do not expose full values)
      const mask = (v: string | null | undefined) => {
        if (!v) return ''
        return v.split(';').map(part => {
          const idx = part.indexOf('=')
          if (idx === -1) return part.trim()
          const name = part.slice(0, idx).trim()
          const val = part.slice(idx + 1).trim()
          if (!val) return `${name}=`
          if (val.length <= 8) return `${name}=${'*'.repeat(val.length)}`
          return `${name}=${val.slice(0,4)}…${val.slice(-4)}`
        }).join('; ')
      }
      const maskedIncomingCookies = mask(incomingCookieHeader)

      // If the portal set cookies, prepare a forwarded Set-Cookie for the client.
      // We strip any Domain attribute so the browser stores the cookie for our origin.
      const rawSetCookie = response.headers.get('set-cookie')
      let forwardedSetCookie: string | null = null
      if (rawSetCookie) {
        forwardedSetCookie = rawSetCookie.replace(/;\s*Domain=[^;]+/gi, '')
      }
    if (!response.ok) {
      return NextResponse.json({ success: false, error: 'Failed to fetch userinfo', status: response.status, responseBody: text }, { status: response.status })
    }

    let data: any
    try {
      data = JSON.parse(text)
    } catch (e) {
      // Portal sometimes returns an HTML login page (when not authenticated) instead of JSON.
      // Detect HTML and return 401 so the client can prompt for re-authentication.
      const contentType = response.headers.get("content-type") || ""
      const looksLikeHtml = contentType.includes("text/html") || text.trim().startsWith("<!DOCTYPE html") || /<html/i.test(text)

      if (looksLikeHtml) {
        // Truncate the HTML for the response body to avoid huge payloads in logs
        const truncated = text.slice(0, 2048)
        // Mask set-cookie values if present
        const maskedHeaders = { ...respHeaders }
        if (maskedHeaders['set-cookie']) {
          maskedHeaders['set-cookie'] = maskedHeaders['set-cookie'].split(',').map(s => {
            // mask cookie value parts
            return s.replace(/=([^;\s]+)/g, (m, v) => `=${v.slice(0,4)}…${v.slice(-4)}`)
          }).join(',')
        }

        // Before returning diagnostics, attempt a best-effort scrape of the portal
        // homepage/profile to extract a student name. This helps when the portal
        // doesn't expose a JSON userinfo endpoint but the user's name is visible
        // on an HTML page. Use cheerio server-side to parse HTML.
        try {
          const profilePaths = ['/', '/details', '/profile', '/details/profile', '/home']
          for (const pp of profilePaths) {
            try {
              const url = `https://student.sbhs.net.au${pp}`
              const r3 = await fetch(url, { headers })
              if (!r3.ok) continue
              const html3 = await r3.text()
              if (!html3 || html3.trim().length === 0) continue
              try {
                const cheerioMod: any = await import('cheerio')
                const $ = cheerioMod.load(html3)
                const nameSelectors = ['.student-name', '.profile-name', '.student-info .name', '[class*="student"] .name', 'h1', 'h2', '.name']
                for (const sel of nameSelectors) {
                  const el = $(sel).first()
                  if (el && el.text()) {
                    const fullName = el.text().trim()
                    if (fullName && fullName.split(' ').length >= 1) {
                      const given = fullName.split(/\s+/)[0]
                      const result = { givenName: given, fullName }
                      const res = NextResponse.json({ success: true, data: result, source: `scraped:${pp}` })
                      if (forwardedSetCookie) res.headers.set('set-cookie', forwardedSetCookie)
                      return res
                    }
                  }
                }
              } catch (e) {
                // ignore cheerio errors and continue to probes below
              }
            } catch (e) {
              // ignore fetch errors for profilePaths
            }
          }
        } catch (e) {
          // ignore any scraping errors and continue to diagnostics
        }

        // Additionally probe a few other endpoints to see which ones accept the session
        const probePaths = ['/notices', '/awards', '/timetable']
        const probeResults: Record<string, any> = {}
        await Promise.all(probePaths.map(async (pp) => {
          try {
            const url = `https://student.sbhs.net.au${pp}`
            const cookieHeader = response.headers.get('set-cookie') ?? headers['Cookie'] ?? ''
            const r2 = await fetch(url, { headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0',
              'Referer': 'https://student.sbhs.net.au/',
              'Cookie': cookieHeader,
            } })
            const ct2 = r2.headers.get('content-type') || ''
            let snippet: string | null = null
            try {
              const t2 = await r2.text()
              snippet = t2.slice(0, 2048)
            } catch (e) {
              snippet = null
            }
            probeResults[pp] = { ok: r2.ok, status: r2.status, contentType: ct2, snippet }
          } catch (e) {
            probeResults[pp] = { error: String(e) }
          }
        }))

        return NextResponse.json(
          {
            success: false,
            error: "Portal returned HTML (likely login page). SBHS session may be missing or expired.",
            responseBody: truncated,
            responseHeaders: maskedHeaders,
            probeResults,
            maskedIncomingCookies,
            sentAuthorization: !!authHeader,
            maskedAuthorization: maskedAuth,
          },
          forwardedSetCookie ? { status: 401, headers: { 'set-cookie': forwardedSetCookie } } : { status: 401 },
        )
      }

      // Otherwise return a 500 with the raw body for debugging
      return NextResponse.json({ success: false, error: 'Invalid JSON from SBHS userinfo', responseBody: text }, { status: 500 })
    }

    // Also include a small headers object for debugging (mask set-cookie)
    const okHeaders = { ...respHeaders }
    if (okHeaders['set-cookie']) {
      okHeaders['set-cookie'] = okHeaders['set-cookie'].split(',').map(s => s.replace(/=([^;\s]+)/g, (m, v) => `=${v.slice(0,4)}…${v.slice(-4)}`)).join(',')
    }

    if (forwardedSetCookie) {
      return NextResponse.json({ success: true, data, responseHeaders: okHeaders }, { headers: { 'set-cookie': forwardedSetCookie } })
    }

    return NextResponse.json({ success: true, data, responseHeaders: okHeaders })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Proxy error', details: String(error) }, { status: 500 })
  }
}
