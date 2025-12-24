import { NextResponse } from 'next/server'

export const runtime = 'edge'
const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => { try { const hasCookie = req && req.headers && typeof req.headers.get === 'function' && Boolean(req.headers.get('cookie')); return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE } } catch (e) { return { 'Cache-Control': SHARED_CACHE } } }

const PORTAL_BASE = 'https://student.sbhs.net.au'
const API_BASE = 'https://api.sbhs.net.au'

async function probeEndpoint(ep: string, headers: Record<string,string>) {
  try {
    const url = ep.startsWith('http') ? ep : `${PORTAL_BASE}${ep}`
    const res = await fetch(url, { headers, redirect: 'follow' })
    const status = res.status
    const ct = res.headers.get('content-type') || ''
    // Short-circuit on upstream server errors to avoid parsing large HTML/error pages
    if (status >= 500 && status <= 599) {
      return { endpoint: url, status, ok: false, contentType: ct, length: 0, parsedCount: 0, error: 'upstream server error' }
    }
    const text = await res.text()
    let parsedCount = 0
    try {
      if (ct.includes('application/json')) {
        const j = JSON.parse(text)
        if (j) {
          if (Array.isArray(j.variations)) parsedCount += j.variations.length
          if (Array.isArray(j.classVariations)) parsedCount += j.classVariations.length
          if (Array.isArray(j.days)) j.days.forEach((d: any) => { if (Array.isArray(d.variations)) parsedCount += d.variations.length })
        }
      }
    } catch (e) {
      // ignore parse errors
    }

    return {
      endpoint: url,
      status: res.status,
      ok: res.ok,
      contentType: ct,
      length: text.length,
      parsedCount,
      snippet: text.slice(0, 2000),
    }
  } catch (err: any) {
    return { endpoint: ep, status: 0, ok: false, contentType: null, length: 0, parsedCount: 0, error: String(err) }
  }
}

export async function GET(req: Request) {
  try {
    const rawCookie = req.headers.get('cookie') || ''
    const accessTokenMatch = rawCookie.match(/(?:^|; )sbhs_access_token=([^;]+)/)
    const accessTokenPresent = !!accessTokenMatch
    const accessTokenValue = accessTokenMatch ? decodeURIComponent(accessTokenMatch[1]) : undefined

    const baseHeaders: Record<string,string> = {
      'Accept': 'application/json, text/html;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Synchron/Debug)'
    }
    if (rawCookie) baseHeaders['Cookie'] = rawCookie
    if (accessTokenPresent) baseHeaders['Authorization'] = `Bearer ${accessTokenValue}`

    const endpoints = ['/timetable/timetable.json', '/timetable/daytimetable.json', '/timetable']
    // Probe portal endpoints in parallel for faster diagnostics
    const results: any[] = []
    try {
      const promises = endpoints.map(ep => probeEndpoint(ep, { ...baseHeaders }))
      const settled = await Promise.allSettled(promises)
      for (let i = 0; i < settled.length; i++) {
        const s = settled[i]
        if (s.status === 'fulfilled') results.push(s.value)
        else results.push({ endpoint: endpoints[i], status: 0, ok: false, error: String((s as any).reason) })
      }
    } catch (e) {
      // fallback to sequential probe if something unexpected fails
      for (const ep of endpoints) {
        results.push(await probeEndpoint(ep, { ...baseHeaders }))
      }
    }

    // Also probe the API host (may accept Bearer tokens even when web host returns login HTML)
    const apiEndpoints = ['/api/timetable/timetable', '/api/timetable/timetable.json', '/api/timetable/daytimetable']
    // Probe API host endpoints in parallel as well
    const apiResults: any[] = []
    try {
      const apiPromises = apiEndpoints.map(ep => probeEndpoint(`${API_BASE}${ep}`, { ...baseHeaders }))
      const settledApi = await Promise.allSettled(apiPromises)
      for (let i = 0; i < settledApi.length; i++) {
        const s = settledApi[i]
        if (s.status === 'fulfilled') apiResults.push(s.value)
        else apiResults.push({ endpoint: `${API_BASE}${apiEndpoints[i]}`, status: 0, ok: false, error: String((s as any).reason) })
      }
    } catch (e) {
      for (const ep of apiEndpoints) {
        apiResults.push(await probeEndpoint(`${API_BASE}${ep}`, { ...baseHeaders }))
      }
    }

    // Do not decode or introspect access tokens here. Token formats can change
    // and should not be parsed for meaning. Keep payload null for safety.
    const accessTokenPayload: any = null

    // Shorten Authorization value for safety
    const forwardedHeaders = { ...baseHeaders }
    if (forwardedHeaders['Authorization']) forwardedHeaders['Authorization'] = forwardedHeaders['Authorization'].slice(0, 32) + '...'

    return NextResponse.json({ ok: true, accessTokenPresent, accessTokenPayload, forwardedHeaders, results, apiResults }, { headers: cacheHeaders(req) })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500, headers: cacheHeaders(req) })
  }
}
