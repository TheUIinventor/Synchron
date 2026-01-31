import { NextRequest, NextResponse } from 'next/server'

// Silence noisy console output on server unless explicit env flag is set.
// This reduces Vercel log I/O and CPU overhead in production.
try {
  const devFlag = typeof process !== 'undefined' && process.env && process.env.SYNCHRON_DEV_LOGS === 'true'
  if (!devFlag) {
    console.log = () => {}
    console.debug = () => {}
    console.info = () => {}
  }
} catch (e) {}

const cacheHeaders = (req: NextRequest) => {
  return { 'Cache-Control': 'private, max-age=0, must-revalidate' }
}

/**
 * Bootstrap endpoint called immediately after sign-in
 * Pre-fetches essential data to populate the app (userinfo, timetable, notices, awards, calendar, etc.)
 * Runs server-side to leverage the fresh access token and avoid CORS issues
 */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('sbhs_access_token')?.value
  
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401, headers: cacheHeaders(req) }
    )
  }

  const origin = req.nextUrl.origin
  const results: any = {}
  const errors: any = {}

  // Helper to fetch an endpoint with error handling
  const fetchEndpoint = async (name: string, path: string) => {
    try {
      const url = `${origin}${path}`
      const res = await fetch(url, {
        headers: {
          'Cookie': `sbhs_access_token=${accessToken}`,
        },
      })
      const data = await res.json()
      results[name] = data
      console.log(`[bootstrap] ✓ Fetched ${name}`)
    } catch (err) {
      errors[name] = String(err)
      console.error(`[bootstrap] ✗ Error fetching ${name}:`, err)
    }
  }

  // Fetch core data in parallel
  await Promise.all([
    fetchEndpoint('userinfo', '/api/portal/userinfo'),
    fetchEndpoint('timetable', '/api/timetable?date=' + formatDate(new Date())),
    fetchEndpoint('notices', '/api/portal/notices'),
    fetchEndpoint('awards', '/api/portal/awards'),
    // reduce calendar window to 90 days to limit payload size
    fetchEndpoint('calendar', '/api/calendar?endpoint=days&from=' + formatDate(new Date()) + '&to=' + formatDate(addDays(new Date(), 90))),
  ])

  return NextResponse.json(
    {
      success: true,
      results,
      ...(Object.keys(errors).length > 0 && { errors }),
    },
    { headers: cacheHeaders(req) }
  )
}

// Utility functions
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
