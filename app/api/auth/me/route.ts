import { NextRequest, NextResponse } from 'next/server'
import { cheapAuthCheck } from '@/lib/auth/checkAuth'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const auth = await cheapAuthCheck(req)
    const payload = {
      authenticated: auth.authenticated,
      tokenMeta: auth.tokenMeta || null,
    }
    const headers = { 'Cache-Control': auth.authenticated ? 'private, max-age=0, must-revalidate' : 'public, s-maxage=60, stale-while-revalidate=300' }
    return NextResponse.json(payload, { headers })
  } catch (e) {
    return NextResponse.json({ authenticated: false, error: String(e) }, { status: 500 })
  }
}
