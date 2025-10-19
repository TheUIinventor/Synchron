import { NextRequest, NextResponse } from 'next/server';

// This route proxies requests to the SBHS Timetable API, including cookies for authentication.
export async function GET(req: NextRequest) {
  const apiUrl = 'https://student.sbhs.net.au/api/timetable/v1/info.json';
  const accessToken = req.cookies.get('sbhs_access_token')?.value
  const refreshToken = req.cookies.get('sbhs_refresh_token')?.value
  if (!accessToken && !refreshToken) {
    return NextResponse.json({ error: 'Missing SBHS access token' }, { status: 401 })
  }

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

    const response = await fetch(apiUrl, { headers })
    const text = await response.text()
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch timetable', status: response.status, responseBody: text }, { status: response.status });
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON from SBHS API', responseBody: text }, { status: 500 });
    }
    // forward Set-Cookie if present
    const sc = response.headers.get('set-cookie')
    if (sc) {
      const forwarded = sc.replace(/;\s*Domain=[^;]+/gi, '')
      return NextResponse.json(data, { headers: { 'set-cookie': forwarded } })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', details: String(error) }, { status: 500 });
  }
}
