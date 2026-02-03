import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Debug endpoint to fetch raw daytimetable.json from a specific SBHS host.
 * Useful for seeing exactly what the upstream servers are returning.
 * 
 * Usage: GET /api/debug/daytimetable-raw?date=2026-02-02&host=student.sbhs.net.au
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get('date') || '2026-02-02';
  const hostParam = url.searchParams.get('host') || 'student.sbhs.net.au';
  const accessToken = req.cookies.get('sbhs_access_token')?.value;
  const incomingCookie = req.headers.get('cookie') || '';

  // Validate host parameter
  if (!['student.sbhs.net.au', 'api.sbhs.net.au'].includes(hostParam)) {
    return NextResponse.json(
      { error: 'Invalid host. Use student.sbhs.net.au or api.sbhs.net.au' },
      { status: 400 }
    );
  }

  const baseHeaders: Record<string, string> = {
    'Accept': 'application/json, text/javascript, */*; q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://student.sbhs.net.au/',
    'Origin': 'https://student.sbhs.net.au',
    'Accept-Language': 'en-AU,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (incomingCookie) baseHeaders['Cookie'] = incomingCookie;
  if (accessToken) baseHeaders['Authorization'] = `Bearer ${accessToken}`;

  try {
    const dayUrl = `https://${hostParam}/api/timetable/daytimetable.json?date=${encodeURIComponent(dateParam)}`;
    
    const response = await fetch(dayUrl, { 
      headers: baseHeaders, 
      redirect: 'follow' 
    });
    const text = await response.text();
    
    let json: any = null;
    let parseError: string | null = null;
    
    try {
      json = JSON.parse(text);
    } catch (e: any) {
      parseError = e.message;
    }
    
    return NextResponse.json({
      debug: {
        dateRequested: dateParam,
        hostRequested: hostParam,
        authenticated: !!accessToken,
        requestedAt: new Date().toISOString(),
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        url: dayUrl,
        contentType: response.headers.get('content-type'),
        json,
        parseError,
        textPreview: text.substring(0, 1000),
        textLength: text.length,
        // Provide structural info
        hasBells: Array.isArray(json?.bells),
        bellsCount: Array.isArray(json?.bells) ? json.bells.length : 0,
        hasTimetable: !!json?.timetable,
        periodCount: Object.keys(json?.timetable?.timetable?.periods || {}).length,
        periodKeys: Object.keys(json?.timetable?.timetable?.periods || {}),
        hasClassVariations: !!json?.classVariations,
        hasRoomVariations: !!json?.roomVariations,
      },
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({
      error: e.message,
      debug: {
        dateRequested: dateParam,
        hostRequested: hostParam,
      },
    }, { status: 500 });
  }
}
