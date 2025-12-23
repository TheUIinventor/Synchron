type CacheEntry = { ts: number; val: any }

function getGlobalCache(): Map<string, CacheEntry> {
  try {
    ;(globalThis as any).__static_cache = (globalThis as any).__static_cache || new Map()
    return (globalThis as any).__static_cache
  } catch (e) {
    return new Map()
  }
}

export async function getStatic<T>(key: string, ttlMs: number, loader?: () => Promise<T>): Promise<T | null> {
  const m = getGlobalCache()
  try {
    const e = m.get(key)
    if (e && (Date.now() - e.ts) < ttlMs) return e.val as T
  } catch (e) {
    // ignore cache read errors
  }

  if (!loader) return null
  const val = await loader()
  try { m.set(key, { ts: Date.now(), val }) } catch (e) {}
  return val
}

export function setStatic(key: string, value: any) {
  try { getGlobalCache().set(key, { ts: Date.now(), val: value }) } catch (e) {}
}

export function clearStatic(key: string) {
  try { getGlobalCache().delete(key) } catch (e) {}
}

export function listStaticKeys(): string[] {
  try { return Array.from(getGlobalCache().keys()) } catch (e) { return [] }
}
