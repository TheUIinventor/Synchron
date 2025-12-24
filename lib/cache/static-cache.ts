export type StaticCacheEntry = { ts: number; ttl: number; val: any }

const getGlobalMap = (): Map<string, StaticCacheEntry> => {
  try {
    if (!(globalThis as any).__synchron_static_cache) (globalThis as any).__synchron_static_cache = new Map()
    return (globalThis as any).__synchron_static_cache as Map<string, StaticCacheEntry>
  } catch (e) {
    // Fallback to a module-scoped map
    if (!(global as any).__synchron_static_cache) (global as any).__synchron_static_cache = new Map()
    return (global as any).__synchron_static_cache as Map<string, StaticCacheEntry>
  }
}

export async function getStatic<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T | null> {
  const map = getGlobalMap()
  try {
    const cur = map.get(key)
    if (cur && (Date.now() - cur.ts) < (cur.ttl || ttlMs)) {
      return cur.val as T
    }
  } catch (e) {}

  try {
    const v = await fetcher()
    try { map.set(key, { ts: Date.now(), ttl: ttlMs, val: v }) } catch (e) {}
    return v
  } catch (e) {
    // If fetcher fails and we had a stale entry, return it
    try {
      const cur = map.get(key)
      if (cur) return cur.val as T
    } catch (e) {}
    return null
  }
}
