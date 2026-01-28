import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Debug endpoint to try various SBHS API endpoints to find where 2026 data is.
 * Tests different hosts, paths, and endpoints to find working sources.
 * 
 * Usage: GET /api/debug/scan-endpoints?date=2026-02-02
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get('date') || '2026-02-02';
  const accessToken = req.cookies.get('sbhs_access_token')?.value;
  const incomingCookie = req.headers.get('cookie') || '';
  const testAuth = req.headers.get('x-test-authorization') || null;

  const baseHeaders: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://student.sbhs.net.au/',
    'Origin': 'https://student.sbhs.net.au',
  };
  if (incomingCookie) baseHeaders['Cookie'] = incomingCookie;
  if (accessToken) baseHeaders['Authorization'] = `Bearer ${accessToken}`;

  const tryEndpoint = async (host: string, path: string) => {
    try {
      const fullUrl = `https://${host}${path}`;
      // Copy base headers and allow dev-only Authorization override
      const headers: Record<string, string> = { ...baseHeaders };
      if (testAuth) {
        headers['Authorization'] = testAuth;
      }
      const response = await fetch(fullUrl, { headers, redirect: 'follow' });
      const text = await response.text();
      
      let json: any = null;
      let error: string | null = null;
      
      try {
        json = JSON.parse(text);
      } catch (e: any) {
        error = e.message;
      }

      const year = json?.timetable?.student?.year || json?.student?.year;
      const periodCount = Object.keys(json?.timetable?.timetable?.periods || {}).length;
      
      return {
        endpoint: `${host}${path}`,
        url: fullUrl,
        status: response.status,
        year,
        periodCount,
        error: error || (response.status !== 200 ? `Status ${response.status}` : null),
        json: response.status === 200 && json ? json : null,
      };
    } catch (e: any) {
      return {
        endpoint: `${host}${path}`,
        url: `https://${host}${path}`,
        status: 0,
        year: null,
        periodCount: 0,
        error: e.message,
        json: null,
      };
    }
  };

  try {
    // Build list of endpoints to test
    const hosts = ['student.sbhs.net.au', 'api.sbhs.net.au'];
    const paths = [
      // Standard endpoints
      `/api/timetable/daytimetable.json?date=${encodeURIComponent(dateParam)}`,
      `/api/timetable/timetable.json`,
      `/api/students/timetable?date=${encodeURIComponent(dateParam)}`,
      `/api/students/timetable.json?date=${encodeURIComponent(dateParam)}`,
      `/api/timetable.json?date=${encodeURIComponent(dateParam)}`,
      `/timetable/daytimetable.json?date=${encodeURIComponent(dateParam)}`,
      `/timetable.json`,
      // Endpoints visible in competitor network trace
      `/sessions?date%5Bbefore%5D=${encodeURIComponent(dateParam)}&date%5Bafter%5D=${encodeURIComponent(dateParam)}`,
      `/dates?date%5Bbefore%5D=${encodeURIComponent(dateParam)}&date%5Bafter%5D=${encodeURIComponent(dateParam)}`,
      `/sessions?date%5Bbefore%5D=2026-12-31&date%5Bafter%5D=${encodeURIComponent(dateParam)}`,
      `/classes?date=${encodeURIComponent(dateParam)}`,
      `/subjects.getSubjects?batch=1&input=`,
      `/subjects.getSubjects?batch=1&input=%7B%7D`,
      `/subjects.getSubjects`,
      `/classes`,
      `/dates?date%5Bbefore%5D=2026-12-31&date%5Bafter%5D=2026-01-28`,
      // Core API endpoints used by Timetabl v2 (student-specific)
      `/api/core/students/449596935/timetable/classes`,
      `/api/core/students/449596935/timetable/dates?date%5Bbefore%5D=${encodeURIComponent(dateParam)}&date%5Bafter%5D=${encodeURIComponent(dateParam)}`,
      `/api/core/students/449596935/timetable/dates?date%5Bbefore%5D=2026-12-31&date%5Bafter%5D=${encodeURIComponent(dateParam)}`,
    ];

    const requests = [];
    for (const host of hosts) {
      for (const path of paths) {
        requests.push(tryEndpoint(host, path));
      }
    }

    const results = await Promise.all(requests);
    
    // Filter and sort by period count (most data first)
    const sorted = results
      .sort((a, b) => (b.periodCount || 0) - (a.periodCount || 0))
      .filter(r => r.status === 200 || r.periodCount > 0);

    const firstWithData = sorted.find(r => r.periodCount > 0);

    return NextResponse.json({
      summary: {
        dateRequested: dateParam,
        endpointsWithData: results.filter(r => r.periodCount > 0).length,
        has2026Year: results.filter(r => r.year && (r.year.includes('2026') || r.year === '12')).length,
      },
      endpoints: results.sort((a, b) => (b.periodCount || 0) - (a.periodCount || 0)),
      raw: firstWithData || null,
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}
