import { NextRequest, NextResponse } from 'next/server';

// This route proxies requests to the SBHS Timetable API, including cookies for authentication.
export async function GET(req: NextRequest) {
  const apiUrl = 'https://student.sbhs.net.au/api/timetable/v1/info.json';
  // Get OAuth access token from cookie
  const accessToken = req.cookies.get('sbhs_access_token')?.value;
  console.log('Incoming access token:', accessToken); // Debug log

  if (!accessToken) {
    console.error('Missing SBHS access token');
    return NextResponse.json({ error: 'Missing SBHS access token' }, { status: 401 });
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    console.log('SBHS API response status:', response.status);
    const text = await response.text();
    console.log('SBHS API response body:', text);

    if (!response.ok) {
      console.error('Failed to fetch timetable', {
        status: response.status,
        accessTokenUsed: accessToken,
        responseBody: text
      });
      return NextResponse.json({ error: 'Failed to fetch timetable', status: response.status, accessTokenUsed: accessToken, responseBody: text }, { status: response.status });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Invalid JSON from SBHS API', text);
      return NextResponse.json({ error: 'Invalid JSON from SBHS API', responseBody: text }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error', {
      error: String(error),
      accessTokenUsed: accessToken
    });
    return NextResponse.json({ error: 'Proxy error', details: String(error), accessTokenUsed: accessToken }, { status: 500 });
  }
}
