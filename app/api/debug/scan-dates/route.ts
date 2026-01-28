import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * Debug endpoint to scan a date range and find which dates have 2026 data.
 * 
 * Usage: GET /api/debug/scan-dates?startDate=2026-02-02&endDate=2026-02-28
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const startDateStr = url.searchParams.get('startDate') || '2026-02-02';
  const endDateStr = url.searchParams.get('endDate') || '2026-02-28';
  const accessToken = req.cookies.get('sbhs_access_token')?.value;
  const incomingCookie = req.headers.get('cookie') || '';

  const baseHeaders: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://student.sbhs.net.au/',
    'Origin': 'https://student.sbhs.net.au',
  };
  if (incomingCookie) baseHeaders['Cookie'] = incomingCookie;
  if (accessToken) baseHeaders['Authorization'] = `Bearer ${accessToken}`;

  const fetchDayData = async (host: string, date: string) => {
    try {
      const url = `https://${host}/api/timetable/daytimetable.json?date=${encodeURIComponent(date)}`;
      const response = await fetch(url, { headers: baseHeaders, redirect: 'follow' });
      const text = await response.text();
      
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch (e) {
        return {
          status: response.status,
          year: null,
          periods: 0,
          hasError: true,
        };
      }

      // Extract student year if available
      const year = json?.timetable?.student?.year;
      const periodCount = Object.keys(json?.timetable?.timetable?.periods || {}).length;
      
      return {
        status: response.status,
        year,
        periods: periodCount,
        hasError: false,
      };
    } catch (e) {
      return {
        status: 500,
        year: null,
        periods: 0,
        hasError: true,
      };
    }
  };

  try {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const results = [];
    let currentDate = new Date(startDate);
    let portal2026 = 0, portal2025 = 0, api2026 = 0, api2025 = 0;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      
      const [portalData, apiData] = await Promise.all([
        fetchDayData('student.sbhs.net.au', dateStr),
        fetchDayData('api.sbhs.net.au', dateStr),
      ]);

      // Determine if data is 2026 or 2025 based on year or by checking the response date/content
      const portalIs2026 = portalData.year === 'Year 12' || portalData.year === '12' || 
                          (portalData.periods > 0 && !portalData.hasError);
      const apiIs2026 = apiData.year === 'Year 12' || apiData.year === '12' || 
                       (apiData.periods > 0 && !apiData.hasError);

      if (portalIs2026) portal2026++;
      else if (portalData.periods > 0) portal2025++;
      
      if (apiIs2026) api2026++;
      else if (apiData.periods > 0) api2025++;

      results.push({
        date: dateStr,
        portalStatus: portalData.status,
        portalYear: portalData.year,
        portalPeriods: portalData.periods,
        apiStatus: apiData.status,
        apiYear: apiData.year,
        apiPeriods: apiData.periods,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return NextResponse.json({
      summary: {
        totalDates: results.length,
        portal2026Count: portal2026,
        portal2025Count: portal2025,
        api2026Count: api2026,
        api2025Count: api2025,
      },
      results,
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}
