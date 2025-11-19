import { NextResponse } from 'next/server'

const PORTAL_BASE = 'https://student.sbhs.net.au'

async function probeEndpoint(ep: string, headers: Record<string,string>) {
  try {
    const res = await fetch(`${PORTAL_BASE}${ep}`, { headers, redirect: 'follow' })
    const ct = res.headers.get('content-type') || ''
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
      endpoint: ep,
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
    const results: any[] = []
    for (const ep of endpoints) {
      results.push(await probeEndpoint(ep, { ...baseHeaders }))
    }

    return NextResponse.json({ ok: true, accessTokenPresent, forwardedHeaders: baseHeaders, results })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
