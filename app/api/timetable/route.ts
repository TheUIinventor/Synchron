import { NextRequest, NextResponse } from 'next/server';

// This route proxies requests to the SBHS Timetable API, including cookies for authentication.
export async function GET(req: NextRequest) {
  const apiUrl = 'https://student.sbhs.net.au/api/timetable/v1/info.json';
  // Use OAuth access token from cookie for authentication
  const accessToken = req.cookies.get('sbhs_access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing SBHS access token' }, { status: 401 });
  }
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    const text = await response.text();
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch timetable', status: response.status, responseBody: text }, { status: response.status });
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON from SBHS API', responseBody: text }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', details: String(error) }, { status: 500 });
  }
}
