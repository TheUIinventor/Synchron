import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
// Force dynamic rendering since we use request.url and cookies
export const dynamic = 'force-dynamic'

const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => {
  try {
    const hasCookie = req && req.cookies && Boolean(req.cookies.get && req.cookies.get('sbhs_access_token'))
    return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE }
  } catch (e) { return { 'Cache-Control': SHARED_CACHE } }
}

/**
 * Proxies SBHS calendar API endpoints:
 * - calendar/days.json - Returns day info (term, week, weekType, dayNumber, dayName) for date range
 * - calendar/terms.json - Returns term dates and holidays
 * 
 * Query params:
 * - endpoint: 'days' | 'terms' (required)
 * - from: YYYY-MM-DD (for days endpoint)
 * - to: YYYY-MM-DD (for days endpoint)
 */

const SBHS_API_BASE = 'https://student.sbhs.net.au/api'

export async function GET(request: NextRequest) {
  // Mute verbose server logs unless explicitly enabled to reduce hosting CPU/log costs
  try {
    const isDev = String(process.env.SYNCHRON_DEV_LOGS || '').toLowerCase() === 'true'
    if (!isDev) {
      console.log = () => {}
      console.debug = () => {}
      console.info = () => {}
    }
  } catch (e) {}
  try {
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint')
    
    if (!endpoint || (endpoint !== 'days' && endpoint !== 'terms')) {
      return NextResponse.json(
        { error: 'Invalid endpoint. Use "days" or "terms"' },
        { status: 400, headers: cacheHeaders(request) }
      )
    }
    
    // Get access token from cookies
    const accessToken = request.cookies.get('sbhs_access_token')?.value
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401, headers: cacheHeaders(request) }
      )
    }
    
    // Build the SBHS API URL
    let sbhsUrl: string
    if (endpoint === 'days') {
      const from = searchParams.get('from')
      const to = searchParams.get('to')
      
      if (!from || !to) {
        return NextResponse.json(
          { error: 'Missing "from" and "to" date parameters for days endpoint' },
          { status: 400, headers: cacheHeaders(request) }
        )
      }
      
      sbhsUrl = `${SBHS_API_BASE}/calendar/days.json?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    } else {
      // terms endpoint
      sbhsUrl = `${SBHS_API_BASE}/calendar/terms.json`
    }
    
    console.log(`[Calendar API] Fetching ${sbhsUrl}`)
    
    // Fetch from SBHS API
    const response = await fetch(sbhsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    })
    
    if (!response.ok) {
      console.error(`[Calendar API] SBHS returned ${response.status}: ${response.statusText}`)
      return NextResponse.json(
        { error: `SBHS API error: ${response.status}` },
        { status: response.status, headers: cacheHeaders(request) }
      )
    }
    
    const data = await response.json()
    
    // Log the response for debugging
    console.log(`[Calendar API] ${endpoint} response:`, JSON.stringify(data).slice(0, 500))
    
    return NextResponse.json(data, { headers: cacheHeaders(request) })
  } catch (error) {
    console.error('[Calendar API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: cacheHeaders(request) }
    )
  }
}
