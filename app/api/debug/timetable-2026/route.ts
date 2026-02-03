import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Debug endpoint to test 2026 timetable data availability from both SBHS hosts.
 * Useful for diagnosing why 2026 data may not be appearing.
 * 
 * Usage: GET /api/debug/timetable-2026?date=2026-02-02
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get('date') || '2026-02-02';
  const accessToken = req.cookies.get('sbhs_access_token')?.value;
  const incomingCookie = req.headers.get('cookie') || '';

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

  async function fetchFromHost(host: string) {
    const dayUrl = `${host}/api/timetable/daytimetable.json?date=${encodeURIComponent(dateParam)}`;
    
    try {
      const response = await fetch(dayUrl, { headers: baseHeaders, redirect: 'follow' });
      const text = await response.text();
      
      let json: any = null;
      let parseError: string | null = null;
      
      try {
        json = JSON.parse(text);
      } catch (e: any) {
        parseError = e.message;
      }
      
      return {
        host,
        url: dayUrl,
        status: response.status,
        statusText: response.statusText,
        hasAuth: !!accessToken,
        json,
        parseError,
        textPreview: text.substring(0, 500),
        hasClasses: json ? (Object.keys(json?.timetable?.timetable?.periods || {}).length > 0) : false,
        periodsCount: json?.timetable?.timetable?.periods ? Object.keys(json.timetable.timetable.periods).length : 0,
        bellsCount: json?.bells ? (Array.isArray(json.bells) ? json.bells.length : 0) : 0,
        studentYear: json?.timetable?.student?.year,
        date: json?.date || dateParam,
      };
    } catch (e: any) {
      return {
        host,
        url: dayUrl,
        error: e.message,
        hasAuth: !!accessToken,
      };
    }
  }

  function getRecommendation(studentResult: any, apiResult: any, hasToken: boolean): string {
    const studentOk = studentResult.status === 200 && !studentResult.parseError;
    const apiOk = apiResult.status === 200 && !apiResult.parseError;
    
    // Mirrors logic in app/api/timetable/route.ts:
    // If authenticated, try api.sbhs.net.au first, then fallback to student.sbhs.net.au
    if (hasToken) {
      if (apiOk) {
        return 'Using api.sbhs.net.au (prioritized for authenticated users)';
      }
      if (studentOk) {
        return 'api.sbhs.net.au failed (404), falling back to student.sbhs.net.au';
      }
      return 'Both hosts failed; no data available';
    }
    
    // If not authenticated, try student.sbhs.net.au first, then fallback to api.sbhs.net.au
    if (studentOk) {
      return 'Using student.sbhs.net.au (prioritized for unauthenticated users)';
    }
    if (apiOk) {
      return 'student.sbhs.net.au failed, falling back to api.sbhs.net.au';
    }
    return 'Both hosts failed; no data available';
  }

  try {
    const [studentResult, apiResult] = await Promise.all([
      fetchFromHost('https://student.sbhs.net.au'),
      fetchFromHost('https://api.sbhs.net.au'),
    ]);

    return NextResponse.json({
      debug: {
        dateRequested: dateParam,
        authenticated: !!accessToken,
        requestedAt: new Date().toISOString(),
      },
      results: {
        'student.sbhs.net.au': studentResult,
        'api.sbhs.net.au': apiResult,
      },
      summary: {
        studentAvailable: studentResult.status === 200 && !studentResult.parseError,
        apiAvailable: apiResult.status === 200 && !apiResult.parseError,
        studentHasClasses: studentResult.hasClasses,
        apiHasClasses: apiResult.hasClasses,
        studentYear: studentResult.studentYear,
        apiYear: apiResult.studentYear,
        recommendation: getRecommendation(studentResult, apiResult, !!accessToken),
      },
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({
      error: e.message,
      dateRequested: dateParam,
    }, { status: 500 });
  }
}
