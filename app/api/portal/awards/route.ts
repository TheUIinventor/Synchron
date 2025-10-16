import { NextResponse, type NextRequest } from "next/server"

const PORTAL_AWARDS = "https://student.sbhs.net.au/awards"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('sbhs_access_token')?.value || null

    try { console.debug('Proxy /api/portal/awards - token present:', !!token) } catch (e) {}

    if (!token) {
      return NextResponse.json({ success: false, error: 'No sbhs_access_token cookie present on this app domain. Please sign in via the app to enable portal access.' }, { status: 401 })
    }

    const headers: Record<string, string> = {}
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
      headers["Accept"] = "application/json"
    }

    const res = await fetch(PORTAL_AWARDS, {
      method: "GET",
      headers,
    })

    const contentType = res.headers.get("content-type") || "text/plain"
    const text = await res.text()

    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(text)
        return NextResponse.json(json, { status: res.status })
      } catch (e) {
        return new Response(text, { status: res.status, headers: { "content-type": contentType } })
      }
    }

    return new Response(text, { status: res.status, headers: { "content-type": contentType } })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Proxy error" }, { status: 500 })
  }
}
