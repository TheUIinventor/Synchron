import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const apiUrl = "https://student.sbhs.net.au/api/dailynews/list.json";
  const accessToken = req.cookies.get('sbhs_access_token')?.value
  const refreshToken = req.cookies.get('sbhs_refresh_token')?.value
  // If neither token present, signal signed-out
  if (!accessToken && !refreshToken) {
    return new Response(JSON.stringify({ error: "Missing SBHS access token" }), { status: 401 })
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
      return new Response(JSON.stringify({ error: "Failed to fetch notices", status: response.status, responseBody: text }), { status: response.status })
    }
    // forward Set-Cookie if present (strip Domain)
    const sc = response.headers.get('set-cookie')
    const options: any = { status: 200 }
    if (sc) {
      const forwarded = sc.replace(/;\s*Domain=[^;]+/gi, '')
      options.headers = { 'set-cookie': forwarded }
    }

    const data = JSON.parse(text)
    return new Response(JSON.stringify(data), options)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Error fetching notices", details: String(err) }),
      { status: 500 }
    );
  }
}
