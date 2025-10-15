import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const apiUrl = "https://student.sbhs.net.au/api/dailynews/list.json";
  // Use OAuth access token from cookie for authentication
  const accessToken = req.cookies.get('sbhs_access_token')?.value;
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing SBHS access token" }), { status: 401 });
  }
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      return new Response(
        JSON.stringify({ error: "Failed to fetch notices", status: response.status, responseBody: text }),
        { status: response.status }
      );
    }
    const data = await response.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Error fetching notices", details: String(err) }),
      { status: 500 }
    );
  }
}
