import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const cookie = body?.cookie || ''
    const target = 'https://portal.clipboard.app/sbhs/calendar'

    const headers: Record<string, string> = {
      'User-Agent': 'Synchron-Proxy/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
    if (cookie && typeof cookie === 'string') headers['Cookie'] = cookie

    const r = await fetch(target, { headers, redirect: 'follow' })
    const text = await r.text()

    // Return as JSON with the HTML payload (caller will set iframe.srcdoc)
    return new Response(JSON.stringify({
      ok: true,
      status: r.status,
      html: text,
      note: 'Experimental proxy: you must provide a valid session cookie string from portal.clipboard.app. This is insecure — do not paste credentials you do not trust. Use at your own risk.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function GET() {
  return new Response(JSON.stringify({ ok: false, error: 'Use POST with { cookie }' }), { headers: { 'Content-Type': 'application/json' } })
}
