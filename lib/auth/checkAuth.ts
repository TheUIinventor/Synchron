import type { NextRequest } from 'next/server'

export type CheapAuthResult = { authenticated: boolean; token?: string | null; tokenMeta?: any }

export async function cheapAuthCheck(req: NextRequest): Promise<CheapAuthResult> {
  try {
    // Prefer cookie-based access token used by the app
    const cookieToken = (req as any).cookies && typeof (req as any).cookies.get === 'function' ? (req as any).cookies.get('sbhs_access_token')?.value : null
    if (cookieToken) return { authenticated: true, token: cookieToken }

    // Fallback: check Authorization header
    try {
      const auth = req.headers && typeof req.headers.get === 'function' ? req.headers.get('authorization') || req.headers.get('Authorization') : null
      if (auth) {
        const parts = String(auth).split(' ')
        const token = parts.length > 1 ? parts[1] : parts[0]
        if (token) return { authenticated: true, token }
      }
    } catch (e) {}

    return { authenticated: false }
  } catch (e) {
    return { authenticated: false }
  }
}
