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

    // Forward SBHS cookies as a Cookie header so endpoints expecting cookie-based sessions work
    const cookieParts: string[] = []
    if (accessToken) cookieParts.push(`sbhs_access_token=${accessToken}`)
    if (refreshToken) cookieParts.push(`sbhs_refresh_token=${refreshToken}`)
    if (cookieParts.length > 0) headers['Cookie'] = cookieParts.join('; ')

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

        return NextResponse.json(
          {
            success: false,
            error: "Portal returned HTML (likely login page). SBHS session may be missing or expired.",
            responseBody: truncated,
            responseHeaders: maskedHeaders,
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
