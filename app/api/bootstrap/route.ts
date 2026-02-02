import { NextRequest, NextResponse } from 'next/server'

const cacheHeaders = (req: NextRequest) => {
  return { 'Cache-Control': 'private, max-age=0, must-revalidate' }
}

/**
 * Lightweight Bootstrap endpoint - returns ONLY critical data for instant UI render
 * Fetches timetable for today with tight timeouts to fail fast
 * Calendar, awards, notices are loaded lazily by client to prevent blocking
 * Target: < 3 seconds for 95th percentile
 */
export async function GET(req: NextRequest) {
  // Mute verbose server logs unless explicitly enabled
  try {
    const isDev = String(process.env.SYNCHRON_DEV_LOGS || '').toLowerCase() === 'true'
    if (!isDev) {
      console.log = () => {}
      console.debug = () => {}
      console.info = () => {}
    }
  } catch (e) {}
  
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

  // Helper to fetch an endpoint with aggressive timeout
  const fetchEndpoint = async (name: string, path: string, timeoutMs = 4000) => {
    try {
      const url = `${origin}${path}`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      
      const res = await fetch(url, {
        headers: {
          'Cookie': `sbhs_access_token=${accessToken}`,
        },
        signal: controller.signal,
      })
      
      clearTimeout(timeout)
      
      const data = await res.json()
      results[name] = data
      console.log(`[bootstrap] ✓ Fetched ${name}`)
    } catch (err) {
      // Silently fail for non-critical endpoints
      if (name !== 'timetable') {
        console.debug(`[bootstrap] ⏭️  Skipped ${name} (will load lazy)`)
        return
      }
      errors[name] = String(err)
      console.error(`[bootstrap] ✗ Error fetching critical ${name}:`, err)
    }
  }

  // Fetch ONLY critical data (timetable) with tight timeout
  // Calendar, awards, notices are skipped and will be loaded lazily by client
  await fetchEndpoint('timetable', '/api/timetable?date=' + formatDate(new Date()), 4000)

  // Only fetch userinfo if we have time (optional, can come from timetable response)
  await Promise.race([
    fetchEndpoint('userinfo', '/api/portal/userinfo', 2000),
    new Promise(r => setTimeout(r, 2000)) // Give max 2s
  ]).catch(() => {})

  return NextResponse.json(
    {
      success: !!results.timetable,
      results,
      // Signal to client that calendar, awards, notices should load lazily
      lazyLoad: ['calendar', 'awards', 'notices'],
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
