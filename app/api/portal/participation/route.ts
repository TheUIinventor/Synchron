import { NextResponse } from "next/server"

const PORTAL_PARTICIPATION = "https://student.sbhs.net.au/details/participation.json"

function getSbhsTokenFromCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/(?:^|; )sbhs_access_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie")
    const token = getSbhsTokenFromCookie(cookieHeader)

    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(PORTAL_PARTICIPATION, {
      method: "GET",
      headers,
      // server-to-server; portal will set cookies on its domain as needed
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
