import { NextResponse } from 'next/server'

export const runtime = 'edge'
const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => { try { const hasCookie = req && req.headers && typeof req.headers.get === 'function' && Boolean(req.headers.get('cookie')); return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE } } catch (e) { return { 'Cache-Control': SHARED_CACHE } } }

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': 'https://student.sbhs.net.au/',
}

function getAllHeaders(res: Response) {
  const obj: Record<string,string> = {}
  res.headers.forEach((v, k) => { obj[k] = v })
  return obj
}

export async function GET(req: Request) {
  try {
    const loginUrl = 'https://student.sbhs.net.au/auth/login'
    const r1 = await fetch(loginUrl, { headers: HEADERS, redirect: 'manual' })
    const text1 = await r1.text()
    const headers1 = getAllHeaders(r1)

    // extract hidden flowid or similar fields
    const tokens: Record<string,string> = {}
    const flowMatch = text1.match(/name=["']?flowid["']?\s+value=["']([^"']+)["']/i) || text1.match(/name=["']flowid["'].*?value=["']([^"']+)["']/i)
    if (flowMatch) tokens['flowid'] = flowMatch[1]

    // If server issued a Location redirect, capture it and attempt one follow
    const location = headers1['location'] || null
    let r2info: any = null
    if (location) {
      try {
        const r2 = await fetch(location.startsWith('http') ? location : `https://student.sbhs.net.au${location}`, { headers: HEADERS, redirect: 'manual' })
        const text2 = await r2.text()
        const headers2 = getAllHeaders(r2)
        r2info = { status: r2.status, headers: headers2, snippet: text2.slice(0, 4096) }
      } catch (e) {
        r2info = { error: String(e) }
      }
    }

    return NextResponse.json({ ok: true, url: loginUrl, status: r1.status, headers: headers1, tokens, location, follow: r2info }, { headers: cacheHeaders(req) })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500, headers: cacheHeaders(req) })
  }
}
