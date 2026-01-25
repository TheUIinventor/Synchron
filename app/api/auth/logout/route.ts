import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'

// Clears auth cookies set by the app and redirects user to the login starter
export async function GET(req: NextRequest) {
  try {
    const homeUrl = new URL('/', req.nextUrl.origin)
    homeUrl.searchParams.set('logged_out', 'true')
    const res = NextResponse.redirect(homeUrl.toString())

    // Clear auth cookies (httpOnly) by setting empty values and maxAge=0
    res.cookies.set('sbhs_access_token', '', { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'lax', path: '/', maxAge: 0 })
    res.cookies.set('sbhs_refresh_token', '', { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'lax', path: '/', maxAge: 0 })
    res.cookies.set('sbhs_oauth_state', '', { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'lax', path: '/', maxAge: 0 })

    // Prevent public caching
    res.headers.set('Cache-Control', NON_SHARED_CACHE)
    return res
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500, headers: { 'Cache-Control': NON_SHARED_CACHE } })
  }
}

// Clear cookies and return JSON (used by client-side POST to logout without navigation)
export async function POST(req: NextRequest) {
  try {
    const res = NextResponse.json({ success: true })

    // Clear auth cookies (httpOnly) by setting empty values and maxAge=0
    res.cookies.set('sbhs_access_token', '', { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'lax', path: '/', maxAge: 0 })
    res.cookies.set('sbhs_refresh_token', '', { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'lax', path: '/', maxAge: 0 })
    res.cookies.set('sbhs_oauth_state', '', { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'lax', path: '/', maxAge: 0 })

    res.headers.set('Cache-Control', NON_SHARED_CACHE)
    return res
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500, headers: { 'Cache-Control': NON_SHARED_CACHE } })
  }
}
