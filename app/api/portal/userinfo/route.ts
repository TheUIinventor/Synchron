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
      // If portal returned HTML or non-JSON, return it for debugging
      return NextResponse.json({ success: false, error: 'Invalid JSON from SBHS userinfo', responseBody: text }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Proxy error', details: String(error) }, { status: 500 })
  }
}
