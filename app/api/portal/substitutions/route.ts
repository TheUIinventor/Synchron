import { NextResponse } from 'next/server'

const PORTAL_BASE = 'https://student.sbhs.net.au'

function normalizeVariation(obj: any) {
  return {
    id: obj.id || obj.variationId || obj.vid || undefined,
    date: obj.date || obj.day || obj.when || undefined,
    period: obj.period || obj.periodName || obj.t || undefined,
    subject: obj.subject || obj.class || obj.title || undefined,
    originalTeacher: obj.teacher || obj.originalTeacher || obj.teacherName || undefined,
    substituteTeacher: obj.substitute || obj.replacement || obj.replacementTeacher || obj.substituteTeacher || undefined,
    fromRoom: obj.fromRoom || obj.from || obj.oldRoom || undefined,
    toRoom: obj.toRoom || obj.to || obj.room || obj.newRoom || undefined,
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
  if (Array.isArray(data.days)) {
    data.days.forEach((d: any) => {
      if (Array.isArray(d.variations)) push(d.variations)
      if (Array.isArray(d.classVariations)) push(d.classVariations)
    })
  }
  if (data.timetable && Array.isArray(data.timetable.variations)) push(data.timetable.variations)

  // shallow recursive search for arrays of objects that look like variations
  const search = (obj: any) => {
    if (!obj || typeof obj !== 'object') return
    for (const k of Object.keys(obj)) {
      const v = obj[k]
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
    const headers: Record<string, string> = {
      'Accept': 'application/json, text/html;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Synchron/1.0; +https://example.com)'
    }
    if (rawCookie) headers['Cookie'] = rawCookie

    // Try JSON endpoints first
    const endpoints = ['/timetable/timetable.json', '/timetable/daytimetable.json']
    for (const ep of endpoints) {
      const res = await fetch(`${PORTAL_BASE}${ep}`, { headers, redirect: 'follow' })
      const ct = res.headers.get('content-type') || ''
      if (res.ok && ct.includes('application/json')) {
        const j = await res.json()
        const subs = collectFromJson(j)
        return NextResponse.json({ substitutions: subs, source: ep, lastUpdated: new Date().toISOString() })
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
