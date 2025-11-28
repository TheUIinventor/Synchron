import { NextRequest, NextResponse } from 'next/server'

// Proxy the SBHS portal userinfo endpoint server-side to avoid CORS issues
export async function GET(req: NextRequest) {
  const apiUrl = 'https://student.sbhs.net.au/details/userinfo.json'
  const accessToken = req.cookies.get('sbhs_access_token')?.value
  const refreshToken = req.cookies.get('sbhs_refresh_token')?.value

  // Name validation helper (top-level so all fallbacks can reuse it)
  const isProbableName = (v: any) => {
    if (!v) return false
    const s = String(v).trim().replace(/\s+/g, ' ')
    if (s.length < 3) return false
    const low = s.toLowerCase()
    const blacklist = new Set(['sign', 'sign in', 'sign-in', 'signing in', 'login', 'log in', 'portal', 'dashboard', 'home', 'student portal', 'profile', 'welcome'])
    if (blacklist.has(low)) return false
    if (/@/.test(s)) return false
    if (/^[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})+$/.test(s)) return true
    if (/^[A-Z][a-z]{2,}$/.test(s)) return true
    return false
  }

  // Helper: try to find a usable name in various JSON shapes
  const extractNameFromJson = (obj: any) => {
    if (!obj) return null
    const tryCandidates = (cands: any[]) => {
      for (const c of cands) {
        if (!c) continue
        try {
          const s = String(c).trim()
          if (isProbableName(s)) return s
        } catch (e) { continue }
      }
      return null
    }

    // Common shapes
    const candidates: any[] = []
    if (typeof obj === 'string') candidates.push(obj)
    if (obj.givenName) candidates.push(obj.givenName)
    if (obj.given_name) candidates.push(obj.given_name)
    if (obj.name) candidates.push(obj.name)
    if (obj.fullName) candidates.push(obj.fullName)
    if (obj.displayName) candidates.push(obj.displayName)
    if (obj.username) candidates.push(obj.username)
    if (obj.student && typeof obj.student === 'object') {
      candidates.push(obj.student.givenName, obj.student.name, obj.student.fullName)
    }
    if (obj.data && typeof obj.data === 'object') {
      candidates.push(obj.data.givenName, obj.data.name, obj.data.fullName, obj.data.displayName)
    }
    if (obj.user && typeof obj.user === 'object') {
      candidates.push(obj.user.name, obj.user.displayName, obj.user.givenName)
    }

    return tryCandidates(candidates)
  }

  // If no access token, return 401 to signal signed-out; client will attempt refresh
  if (!accessToken && !refreshToken) {
    return NextResponse.json({ success: false, error: 'Missing SBHS access token' }, { status: 401 })
  }
  // If we have an access token that appears to be a JWT, try to decode it
  // and extract common name claims as a fast fallback. This does not verify
  // the token signature; it's only used to populate a friendly greeting when
  // the portal doesn't return JSON and scraping fails.
  try {

    if (accessToken && typeof accessToken === 'string') {
      const parts = accessToken.split('.')
      if (parts.length === 3) {
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        try {
          const decoded = Buffer.from(payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '='), 'base64').toString('utf8')
          const claims = JSON.parse(decoded)
          const possibleName = claims.given_name || claims.givenName || claims.name || claims.preferred_username || claims.email || null
          if (possibleName && isProbableName(possibleName)) {
            const given = (typeof possibleName === 'string' && possibleName.split) ? String(possibleName).split(/\s+/)[0] : null
            return NextResponse.json({ success: true, data: { givenName: given, rawClaims: { sub: claims.sub || null } }, source: 'token' })
          }
        } catch (e) {
          // ignore decode errors and continue to proxy/fallback
        }
      }
    }
  } catch (e) {
    // ignore
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

    // First: try a list of likely API hosts/paths that may expose JSON userinfo.
    const apiHosts = ['https://api.sbhs.net.au', 'https://student.sbhs.net.au', 'https://student.sbhs.net.au/api']
    const apiPaths = ['/details/userinfo.json', '/details/userinfo', '/api/userinfo.json', '/api/userinfo', '/details/profile.json', '/details/profile']

    for (const host of apiHosts) {
      for (const path of apiPaths) {
        try {
          const url = `${host.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`
          const r = await fetch(url, { headers })
          if (!r.ok) continue
          const ct = r.headers.get('content-type') || ''
          if (ct.includes('application/json')) {
            try {
              const j = await r.json()
              const found = extractNameFromJson(j)
              if (found) {
                const given = found.split(/\s+/)[0]
                const res = NextResponse.json({ success: true, data: { givenName: given, fullName: found, raw: j }, source: `api:${host}${path}` })
                // propagate any set-cookie header we received
                const sc = r.headers.get('set-cookie')
                if (sc) res.headers.set('set-cookie', sc.replace(/;\s*Domain=[^;]+/gi, ''))
                return res
              }
            } catch (e) {
              // ignore JSON parse errors and continue
            }
          }
        } catch (e) {
          // ignore fetch errors for these probes
        }
      }
    }

    // Fallback: request the configured API URL (keeps previous behavior)
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
        // on an HTML page. Use cheerio server-side to parse HTML and run a few
        // broader heuristics (selectors, title/meta, and greeting regex).
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
                // Try common selectors first
                const nameSelectors = ['.student-name', '.profile-name', '.student-info .name', '[class*="student"] .name', 'h1', 'h2', '.name', '.profile-header', '.user-name']
                for (const sel of nameSelectors) {
                  const el = $(sel).first()
                  if (el && el.text()) {
                    const fullName = el.text().trim().replace(/\s{2,}/g, ' ')
                    if (isProbableName(fullName)) {
                      const given = fullName.split(/\s+/)[0]
                      const result = { givenName: given, fullName }
                      const res = NextResponse.json({ success: true, data: result, source: `scraped:${pp}` })
                      if (forwardedSetCookie) res.headers.set('set-cookie', forwardedSetCookie)
                      return res
                    }
                  }
                }

                // Fallback: title/meta tags
                const title = ($('title').first().text() || '').trim()
                if (title && /[A-Za-z]/.test(title)) {
                  // Look for a name-looking substring in the title (e.g. "Welcome Sam Smith")
                  const m = title.match(/(?:Welcome|Hi|Hello|Signed in as|Signed in)[:,\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/)
                  if (m && m[1]) {
                    const fullName = m[1].trim()
                    if (isProbableName(fullName)) {
                      const given = fullName.split(/\s+/)[0]
                      const res = NextResponse.json({ success: true, data: { givenName: given, fullName }, source: `title:${pp}` })
                      if (forwardedSetCookie) res.headers.set('set-cookie', forwardedSetCookie)
                      return res
                    }
                  }
                }

                const metaAuthor = ($('meta[name="author"]').attr('content') || '').trim()
                if (metaAuthor) {
                  const fullName = metaAuthor
                  if (isProbableName(fullName)) {
                    const given = fullName.split(/\s+/)[0]
                    const res = NextResponse.json({ success: true, data: { givenName: given, fullName }, source: `meta:${pp}` })
                    if (forwardedSetCookie) res.headers.set('set-cookie', forwardedSetCookie)
                    return res
                  }
                }

                // Fallback: greeting regex over visible text (collapse whitespace to simplify)
                const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
                if (bodyText && bodyText.length > 0) {
                  // Look for patterns like "Welcome Sam", "Hi Sam", "Hello Sam" or "Signed in as Sam Smith"
                  const greet = bodyText.match(/(?:Welcome|Hi|Hello|Signed in as|Signed in)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/)
                  if (greet && greet[1]) {
                    const fullName = greet[1].trim()
                    if (isProbableName(fullName)) {
                      const given = fullName.split(/\s+/)[0]
                      const res = NextResponse.json({ success: true, data: { givenName: given, fullName }, source: `greeting:${pp}` })
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

        // If scraping didn't yield a name, try a final JWT decode fallback that
        // returns all token claims as the response payload. This gives the app
        // full token data to extract a name client-side if present.
        try {
          if (accessToken && typeof accessToken === 'string') {
            const parts = accessToken.split('.')
            if (parts.length >= 2) {
              const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
              try {
                const decoded = Buffer.from(payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '='), 'base64').toString('utf8')
                const claims = JSON.parse(decoded)
                const possibleName = claims.given_name || claims.givenName || claims.name || claims.preferred_username || null
                const valid = possibleName && isProbableName(possibleName) ? String(possibleName).trim() : null
                const given = valid ? valid.split(/\s+/)[0] : null
                const payload: any = { tokenClaims: claims }
                if (valid) payload.givenName = given
                if (valid) payload.fullName = valid
                return NextResponse.json({ success: true, data: payload, source: 'token:claims' })
              } catch (e) {
                // ignore decode errors and continue to diagnostics
              }
            }
          }
        } catch (e) {
          // ignore
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
