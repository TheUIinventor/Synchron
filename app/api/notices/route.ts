import { NextRequest } from "next/server";

export const runtime = 'edge'

const SHARED_CACHE = 'public, s-maxage=60, stale-while-revalidate=3600'
const NON_SHARED_CACHE = 'private, max-age=0, must-revalidate'
const cacheHeaders = (req: any) => {
  try { const hasCookie = req && req.cookies && Boolean(req.cookies.get && (req.cookies.get('sbhs_access_token') || req.cookies.get('sbhs_refresh_token'))); return { 'Cache-Control': hasCookie ? NON_SHARED_CACHE : SHARED_CACHE } } catch (e) { return { 'Cache-Control': SHARED_CACHE } }
}

export async function GET(req: NextRequest) {
  const apiUrl = "https://student.sbhs.net.au/api/dailynews/list.json";
  const accessToken = req.cookies.get('sbhs_access_token')?.value
  const refreshToken = req.cookies.get('sbhs_refresh_token')?.value
  // If neither token present, signal signed-out
  if (!accessToken && !refreshToken) {
    return new Response(JSON.stringify({ error: "Missing SBHS access token" }), { status: 401, headers: cacheHeaders(req) })
  }

  try {
    const headers: Record<string,string> = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://student.sbhs.net.au/',
    }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const cookieParts: string[] = []
    if (accessToken) cookieParts.push(`sbhs_access_token=${accessToken}`)
    if (refreshToken) cookieParts.push(`sbhs_refresh_token=${refreshToken}`)
    if (cookieParts.length) headers['Cookie'] = cookieParts.join('; ')

    const response = await fetch(apiUrl, { headers })
    const text = await response.text()
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch notices", status: response.status, responseBody: text }), { status: response.status, headers: cacheHeaders(req) })
    }
    // forward Set-Cookie if present (strip Domain)
    const sc = response.headers.get('set-cookie')
    const options: any = { status: 200 }
    if (sc) {
      const forwarded = sc.replace(/;\s*Domain=[^;]+/gi, '')
      options.headers = { 'set-cookie': forwarded }
    }

    const data = JSON.parse(text)
    // Attach cache header based on authentication presence (do not public-cache private user content)
    options.headers = Object.assign({}, options.headers || {}, cacheHeaders(req))
    return new Response(JSON.stringify(data), options)
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error fetching notices", details: String(err) }), { status: 500, headers: cacheHeaders(req) })
  }
}
