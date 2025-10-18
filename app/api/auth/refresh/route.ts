import { NextResponse, type NextRequest } from 'next/server'

const TOKEN_ENDPOINT = process.env.SBHS_TOKEN_ENDPOINT || 'https://auth.sbhs.net.au/token'

export async function GET(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('sbhs_refresh_token')?.value || null
    if (!refreshToken) {
      return NextResponse.json({ success: false, error: 'No refresh token present' }, { status: 401 })
    }

    const params = new URLSearchParams()
    params.append('grant_type', 'refresh_token')
    params.append('refresh_token', refreshToken)
    params.append('client_id', process.env.SBHS_APP_ID || '')
    params.append('client_secret', process.env.SBHS_APP_SECRET || '')

    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      return NextResponse.json({ success: false, error: 'Token endpoint error', details: text }, { status: tokenRes.status })
    }

    const tok = await tokenRes.json()
    const newAccess = tok.access_token
    const newRefresh = tok.refresh_token
    const expiresIn = tok.expires_in || 3600

    const res = NextResponse.json({ success: true })
    res.cookies.set('sbhs_access_token', newAccess, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/',
    })
    if (newRefresh) {
      res.cookies.set('sbhs_refresh_token', newRefresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
    }

    return res
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'refresh error' }, { status: 500 })
  }
}
