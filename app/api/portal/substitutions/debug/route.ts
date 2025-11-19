import { NextResponse } from 'next/server'

const PORTAL_BASE = 'https://student.sbhs.net.au'

async function probeEndpoint(ep: string, headers: Record<string,string>, rawCookie: string) {
  try {
    if (rawCookie) headers['Cookie'] = rawCookie
    const res = await fetch(`${PORTAL_BASE}${ep}`, { headers, redirect: 'follow' })
    const ct = res.headers.get('content-type') || ''
    const text = await res.text()
    let parsedCount = 0
    try {
      if (ct.includes('application/json')) {
        const j = JSON.parse(text)
        // naive scan for arrays/objects named variations/classVariations/days
        if (j) {
          if (Array.isArray(j.variations)) parsedCount += j.variations.length
          if (Array.isArray(j.classVariations)) parsedCount += j.classVariations.length
          if (Array.isArray(j.days)) {
            j.days.forEach((d: any) => { if (Array.isArray(d.variations)) parsedCount += d.variations.length })
          }
        }
      }
    } catch (e) {
      // ignore json parse errors
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
  } catch (err) {
    return {
      endpoint: ep,
      status: 0,
      ok: false,
      contentType: null,
      length: 0,
      parsedCount: 0,
      error: String(err),
    }
  }
}

export async function GET(req: Request) {
  try {
    const rawCookie = req.headers.get('cookie') || ''
    const headers: Record<string,string> = {
      'Accept': 'application/json, text/html;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Synchron/Debug)'
    }

    const endpoints = ['/timetable/timetable.json', '/timetable/daytimetable.json', '/timetable']
    const results: any[] = []

    for (const ep of endpoints) {
      const r = await probeEndpoint(ep, { ...headers }, rawCookie)
      results.push(r)
      // if we found parsedCount > 0 for JSON endpoints, continue to return all but note it
    }

    return NextResponse.json({ ok: true, results }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
