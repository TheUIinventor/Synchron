import { NextRequest, NextResponse } from 'next/server'

// Proxy the SBHS portal userinfo endpoint server-side to avoid CORS issues
export async function GET(req: NextRequest) {
  const apiUrl = 'https://student.sbhs.net.au/details/userinfo.json'
  const accessToken = req.cookies.get('sbhs_access_token')?.value
  if (!accessToken) {
    return NextResponse.json({ success: false, error: 'Missing SBHS access token' }, { status: 401 })
  }

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      // server-side fetch does not need credentials: include because we set Authorization header
    })

    const text = await response.text()
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
        return NextResponse.json(
          {
            success: false,
            error: "Portal returned HTML (likely login page). SBHS session may be missing or expired.",
            responseBody: truncated,
          },
          { status: 401 },
        )
      }

      // Otherwise return a 500 with the raw body for debugging
      return NextResponse.json({ success: false, error: 'Invalid JSON from SBHS userinfo', responseBody: text }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Proxy error', details: String(error) }, { status: 500 })
  }
}
