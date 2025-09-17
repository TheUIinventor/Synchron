import { NextRequest, NextResponse } from 'next/server';

// This route proxies requests to the SBHS Timetable API, including cookies for authentication.
export async function GET(req: NextRequest) {
  const apiUrl = 'https://student.sbhs.net.au/api/timetable/v1/info.json';
  // Forward cookies from the incoming request
  const cookie = req.headers.get('cookie');
  console.log('Incoming cookie header:', cookie); // Debug log

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookie || '',
        'Accept': 'application/json',
      },
      credentials: 'include',
    });
    console.log('SBHS API response status:', response.status);
    const text = await response.text();
    console.log('SBHS API response body:', text);

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch timetable', status: response.status, cookieReceived: cookie, responseBody: text }, { status: response.status });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON from SBHS API', responseBody: text }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', details: String(error), cookieReceived: cookie }, { status: 500 });
  }
}
