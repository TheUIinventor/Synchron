import { NextRequest, NextResponse } from 'next/server';

const clientId = process.env.SBHS_CLIENT_ID;
const clientSecret = process.env.SBHS_CLIENT_SECRET;
const redirectUri = process.env.SBHS_REDIRECT_URI;

// Exchange authorization code for access token
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  console.log('OAuth callback: received code:', code);
  if (!code) {
    console.error('OAuth callback: missing authorization code');
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
  console.log('OAuth callback: token request body:', body.toString());

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const text = await response.text();
    console.log('OAuth callback: token response status:', response.status);
    console.log('OAuth callback: token response body:', text);
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('OAuth callback: invalid JSON from token endpoint', text);
      return NextResponse.json({ error: 'Invalid JSON from token endpoint', responseBody: text }, { status: 500 });
    }
    if (!response.ok) {
      console.error('OAuth callback: failed to fetch access token', data);
      return NextResponse.json({ error: 'Failed to fetch access token', details: data }, { status: response.status });
    }
    // Store access token in a secure cookie
    const res = NextResponse.redirect('/');
    res.cookies.set('sbhs_access_token', data.access_token, { httpOnly: true, secure: true, path: '/' });
    console.log('OAuth callback: set sbhs_access_token cookie:', data.access_token);
    return res;
  } catch (error) {
    console.error('OAuth callback: token exchange error', String(error));
    return NextResponse.json({ error: 'Token exchange error', details: String(error) }, { status: 500 });
  }
}
