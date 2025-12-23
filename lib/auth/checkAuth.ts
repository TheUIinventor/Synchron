import type { Decoded } from './token-cache'
import { getCachedDecoded, setCachedDecoded, simpleHash } from './token-cache'

// Lightweight auth check: extract token, try cache, decode payload without
// verifying signature (verification can be added later and cached). This is
// intentionally cheap and safe for middleware-level fast checks.
export async function cheapAuthCheck(req: Request | any): Promise<{ authenticated: boolean; token?: string; tokenMeta?: Decoded | null }> {
  try {
    // Prefer Next.js NextRequest cookie access when available
    let token: string | null = null
    try {
      if (req && typeof req.cookies === 'object' && typeof req.cookies.get === 'function') {
        token = req.cookies.get('sbhs_access_token')?.value || null
      }
    } catch (e) { token = null }

    // Fallback: parse Cookie header
    if (!token) {
      try {
        const cookieHeader = (req && req.headers && typeof req.headers.get === 'function') ? req.headers.get('cookie') : (req && req.headers && req.headers.cookie) || ''
        if (cookieHeader) {
          const parts = cookieHeader.split(';').map(s => s.trim())
          for (const p of parts) {
            const idx = p.indexOf('=')
            if (idx === -1) continue
            const name = p.slice(0, idx).trim()
            const val = p.slice(idx + 1)
            if (name === 'sbhs_access_token') { token = val; break }
          }
        }
      } catch (e) { /* ignore */ }
    }

    if (!token) return { authenticated: false }

    const h = simpleHash(token)
    const cached = getCachedDecoded(h)
    if (cached) return { authenticated: true, token, tokenMeta: cached }

    // Cheap decode: JWT payload is base64url at part 2
    try {
      const parts = token.split('.')
      if (parts.length >= 2) {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        // pad
        const pad = b64.length % 4
        const padded = pad ? b64 + '='.repeat(4 - pad) : b64
        const decoded = atob(padded)
        const obj = JSON.parse(decoded)
        setCachedDecoded(h, obj)
        return { authenticated: true, token, tokenMeta: obj }
      }
    } catch (e) {
      // if decode fails, still return authenticated = true with no meta
      try { setCachedDecoded(h, {}) } catch (e) {}
      return { authenticated: true, token, tokenMeta: null }
    }

    return { authenticated: true, token, tokenMeta: null }
  } catch (e) {
    return { authenticated: false }
  }
}
