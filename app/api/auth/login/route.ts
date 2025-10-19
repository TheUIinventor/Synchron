import { NextRequest, NextResponse } from 'next/server';

const clientId = process.env.SBHS_CLIENT_ID;
const clientSecret = process.env.SBHS_CLIENT_SECRET;
const redirectUri = process.env.SBHS_REDIRECT_URI;

// This route will redirect the user to the SBHS OAuth authorization page
export async function GET(req: NextRequest) {
  // redirectUri can be undefined in some environments (build/time). Guard encodeURIComponent
  const safeRedirect = typeof redirectUri === "string" ? encodeURIComponent(redirectUri) : "";
  const authorizeUrl = `https://student.sbhs.net.au/api/auth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${safeRedirect}&scope=read`;
  return NextResponse.redirect(authorizeUrl);
}
