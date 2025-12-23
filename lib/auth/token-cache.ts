type Decoded = { [k: string]: any }
const DEFAULT_TTL = 1000 * 60 * 10 // 10 minutes

function getGlobalCache(): Map<string, { ts: number; val: Decoded }> {
  try {
    ;(globalThis as any).__token_cache = (globalThis as any).__token_cache || new Map()
    return (globalThis as any).__token_cache
  } catch (e) {
    return new Map()
  }
}

export function simpleHash(input: string): string {
  try {
    let h = 5381
    for (let i = 0; i < input.length; i++) h = ((h << 5) + h) + input.charCodeAt(i)
    return String(h >>> 0)
  } catch (e) { return String(Math.random()).slice(2) }
}

export function getCachedDecoded(tokenHash: string, ttl = DEFAULT_TTL): Decoded | null {
  try {
    const m = getGlobalCache()
    const entry = m.get(tokenHash)
    if (!entry) return null
    if (Date.now() - entry.ts > ttl) { m.delete(tokenHash); return null }
    return entry.val
  } catch (e) { return null }
}

export function setCachedDecoded(tokenHash: string, val: Decoded) {
  try {
    const m = getGlobalCache()
    m.set(tokenHash, { ts: Date.now(), val })
  } catch (e) { /* ignore */ }
}

export function clearTokenCache() {
  try { getGlobalCache().clear() } catch (e) {}
}

export type { Decoded }
