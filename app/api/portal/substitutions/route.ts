import { NextResponse } from 'next/server'

const PORTAL_BASE = 'https://student.sbhs.net.au'
const API_BASE = 'https://api.sbhs.net.au'

function normalizeVariation(obj: any) {
  return {
    id: obj.id || obj.variationId || obj.vid || undefined,
    date: obj.date || obj.day || obj.when || undefined,
    period: obj.period || obj.periodName || obj.t || undefined,
    subject: obj.subject || obj.class || obj.title || undefined,
    originalTeacher: obj.teacher || obj.originalTeacher || obj.teacherName || undefined,
    substituteTeacher: obj.substitute || obj.replacement || obj.replacementTeacher || obj.substituteTeacher || obj.casual || undefined,
    casual: obj.casual || undefined,
    casualSurname: obj.casualSurname || undefined,
    substituteTeacherFull: obj.casualSurname ? (obj.casual ? `${obj.casual} ${obj.casualSurname}` : obj.casualSurname) : (obj.substituteFullName || obj.substituteFull || undefined),
    fromRoom: obj.fromRoom || obj.from || obj.oldRoom || obj.roomFrom || obj.room_from || undefined,
    toRoom: obj.toRoom || obj.to || obj.room || obj.newRoom || obj.roomTo || obj.room_to || undefined,
    reason: obj.reason || obj.note || obj.comment || undefined,
    raw: obj,
  }
}

function collectFromJson(data: any) {
  const collected: any[] = []
  const push = (v: any) => {
    if (!v) return
    if (Array.isArray(v)) v.forEach((x) => collected.push(normalizeVariation(x)))
    else if (typeof v === 'object') collected.push(normalizeVariation(v))
  }

  if (Array.isArray(data.variations)) push(data.variations)
  if (Array.isArray(data.classVariations)) push(data.classVariations)
  // handle object maps like { "3": { ... }, "RC": { ... } }
  if (data.roomVariations && typeof data.roomVariations === 'object') {
    if (Array.isArray(data.roomVariations)) push(data.roomVariations)
    else Object.values(data.roomVariations).forEach((v: any) => push(v))
  }
  if (data.classVariations && typeof data.classVariations === 'object') {
    if (Array.isArray(data.classVariations)) push(data.classVariations)
    else Object.values(data.classVariations).forEach((v: any) => push(v))
  }
  if (Array.isArray(data.days)) {
    data.days.forEach((d: any) => {
      if (Array.isArray(d.variations)) push(d.variations)
      if (Array.isArray(d.classVariations)) push(d.classVariations)
      if (d.roomVariations && typeof d.roomVariations === 'object') {
        if (Array.isArray(d.roomVariations)) push(d.roomVariations)
        else Object.values(d.roomVariations).forEach((v: any) => push(v))
      }
    })
  }
  if (data.timetable && Array.isArray(data.timetable.variations)) push(data.timetable.variations)

  // shallow recursive search for arrays of objects that look like variations
  const search = (obj: any) => {
    if (!obj || typeof obj !== 'object') return
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      // if we find keys that indicate a variations map, iterate its values
      if (k.toLowerCase().includes('roomvariation') || k.toLowerCase().includes('classvariation')) {
        if (Array.isArray(v)) push(v)
        else if (typeof v === 'object') Object.values(v).forEach((x: any) => push(x))
        continue
      }
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        const keys = Object.keys(v[0]).join('|').toLowerCase()
        if (keys.includes('substitute') || keys.includes('variation') || keys.includes('room') || keys.includes('teacher')) push(v)
      } else if (typeof v === 'object') search(v)
    }
  }

  search(data)
  return collected
}

export async function GET(req: Request) {
  try {
    const rawCookie = req.headers.get('cookie') || ''
    // If the app has a stored sbhs_access_token (set by our auth callback), forward it as a Bearer token.
    // This is necessary because browser cookies for student.sbhs.net.au are not available to the server proxy.
    const accessToken = (() => {
      try {
        // Next.js Request in Edge/Route handler doesn't expose cookies via req.cookies, so parse header as fallback
        const m = rawCookie.match(/(?:^|; )sbhs_access_token=([^;]+)/)
        return m ? decodeURIComponent(m[1]) : undefined
      } catch { return undefined }
    })()

    const headers: Record<string, string> = {
      'Accept': 'application/json, text/html;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Synchron/1.0; +https://example.com)'
    }
    if (rawCookie) headers['Cookie'] = rawCookie
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

    // Try API host first when we have a bearer token (API may accept token where portal web pages require session cookies)
    const jsonPaths = ['/api/timetable/timetable.json', '/api/timetable/daytimetable.json']
    if (accessToken) {
      for (const p of jsonPaths) {
        try {
          const res = await fetch(`${API_BASE}${p}`, { headers, redirect: 'follow' })
          const ct = res.headers.get('content-type') || ''
          if (res.ok && ct.includes('application/json')) {
            const j = await res.json()
            const subs = collectFromJson(j)
            return NextResponse.json({ substitutions: subs, source: `${API_BASE}${p}`, lastUpdated: new Date().toISOString() })
          }
        } catch (e) {
          // ignore and fall back to portal
        }
      }
    }

    // Try portal JSON endpoints next (may require session cookie)
    const endpoints = ['/timetable/timetable.json', '/timetable/daytimetable.json']
    for (const ep of endpoints) {
      const res = await fetch(`${PORTAL_BASE}${ep}`, { headers, redirect: 'follow' })
      const ct = res.headers.get('content-type') || ''
      if (res.ok && ct.includes('application/json')) {
        const j = await res.json()
        const subs = collectFromJson(j)
        return NextResponse.json({ substitutions: subs, source: `${PORTAL_BASE}${ep}`, lastUpdated: new Date().toISOString() })
      }
    }

    // If JSON endpoints not available, fetch HTML timetable page and return as text for client scraping fallback
    const htmlRes = await fetch(`${PORTAL_BASE}/timetable`, { headers, redirect: 'follow' })
    const html = await htmlRes.text()
    // return HTML so client can scrape; also attempt to find variations in JSON within page
    return new NextResponse(html, { status: htmlRes.ok ? 200 : htmlRes.status, headers: { 'content-type': htmlRes.headers.get('content-type') || 'text/html; charset=utf-8' } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
