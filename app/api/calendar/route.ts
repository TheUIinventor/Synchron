import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering since we use request.url and cookies
export const dynamic = 'force-dynamic'

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

// Short-term in-memory cache for calendar responses to absorb polling bursts.
type CalCached = { timestamp: number; payload: any }
const calInMemory = new Map<string, CalCached>()
const CAL_INMEM_TTL = 1000 * 60 * 5 // 5 minutes
// Shared cache header (safe because calendar data is not user-specific)
const SHARED_CACHE = 'public, s-maxage=300, stale-while-revalidate=600'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint')
    
    if (!endpoint || (endpoint !== 'days' && endpoint !== 'terms')) {
      return NextResponse.json(
        { error: 'Invalid endpoint. Use "days" or "terms"' },
        { status: 400 }
      )
    }
    
    // Get access token from cookies (SBHS requires auth for this proxy)
    const accessToken = request.cookies.get('sbhs_access_token')?.value

    // Build a cache key from endpoint + params. Calendar/terms data is
    // canonical (not user-specific) so it's safe to cache regardless of
    // which authenticated user requested it. This reduces upstream load.
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const cacheKey = `calendar:${endpoint}:${from}:${to}`
    const cached = calInMemory.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CAL_INMEM_TTL) {
      try { console.debug('[Calendar API] served from in-memory cache', cacheKey) } catch (e) {}
      return NextResponse.json(cached.payload, { status: 200, headers: { 'Cache-Control': SHARED_CACHE } })
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
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
          { status: 400 }
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
        { status: response.status }
      )
    }
    
    const data = await response.json()

    // Cache the response payload in-memory for a short TTL to reduce repeated
    // upstream requests during client polling bursts.
    try {
      calInMemory.set(cacheKey, { timestamp: Date.now(), payload: data })
      try { console.debug('[Calendar API] cached in-memory', cacheKey) } catch (e) {}
    } catch (e) {
      // ignore cache set failures
    }

    // Log the response for debugging
    console.log(`[Calendar API] ${endpoint} response:`, JSON.stringify(data).slice(0, 500))

    return NextResponse.json(data, { headers: { 'Cache-Control': SHARED_CACHE } })
  } catch (error) {
    console.error('[Calendar API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
