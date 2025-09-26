import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const apiUrl = "https://student.sbhs.net.au/api/dailynews/list.json";
  // TODO: Add authentication (access token/cookie) if required by SBHS API
  try {
    const response = await fetch(apiUrl, {
      // Add headers/cookies if needed for authentication
      credentials: "include",
    });
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch notices" }),
        { status: response.status }
      );
    }
    const data = await response.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Error fetching notices" }),
      { status: 500 }
    );
  }
}
