import { NextResponse } from 'next/server'

function parseCookies(cookieHeader: string | null) {
  if (!cookieHeader) return {}
  return cookieHeader.split(';').map(s => s.trim()).filter(Boolean).reduce((acc: Record<string,string>, cur) => {
    const idx = cur.indexOf('=')
    if (idx === -1) return acc
    const name = cur.slice(0, idx).trim()
    const value = cur.slice(idx + 1)
    acc[name] = value
    return acc
  }, {})
}

function mask(v: string) {
  if (!v) return ''
  if (v.length <= 8) return v.replace(/./g, '*')
  return `${v.slice(0,4)}…${v.slice(-4)}`
}

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie')
    const cookies = parseCookies(cookieHeader)
    const masked: Record<string,string> = {}
    for (const k of Object.keys(cookies)) {
      masked[k] = mask(cookies[k])
    }

    return NextResponse.json({ ok: true, cookies: masked, count: Object.keys(masked).length })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
