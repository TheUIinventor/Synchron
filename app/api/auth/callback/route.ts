import { NextRequest, NextResponse } from 'next/server';

const clientId = process.env.SBHS_CLIENT_ID;
const clientSecret = process.env.SBHS_CLIENT_SECRET;
const redirectUri = process.env.SBHS_REDIRECT_URI;

// Exchange authorization code for access token
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  const tokenUrl = 'https://student.sbhs.net.au/api/auth/token';
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri || '',
    client_id: clientId || '',
    client_secret: clientSecret || '',
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch access token', details: data }, { status: response.status });
    }
    // Store access token in a secure cookie
    const res = NextResponse.redirect('/');
    res.cookies.set('sbhs_access_token', data.access_token, { httpOnly: true, secure: true, path: '/' });
    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Token exchange error', details: String(error) }, { status: 500 });
  }
}
