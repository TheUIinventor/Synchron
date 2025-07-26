// app/auth/callback/route.js
import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Ensure these environment variables are set in .env.local AND Vercel Dashboard
  const clientId = process.env.SBHS_APP_ID;
  const clientSecret = process.env.SBHS_APP_SECRET;

  // *** IMPORTANT: Updated Redirect URI for app/auth/callback structure ***
  // This MUST exactly match the Redirect URI you registered in the SBHS portal!
  const redirectUri = process.env.NODE_ENV === 'development'
                      ? process.env.NEXT_PUBLIC_SBHS_REDIRECT_URI_LOCAL // For local testing (http://localhost/auth/callback)
                      : process.env.NEXT_PUBLIC_SBHS_REDIRECT_URI_VERCEL; // For Vercel deployment (https://synchronapp.vercel.app/auth/callback)

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("Missing environment variables for OAuth callback.");
    return NextResponse.json(
      { error: 'Server configuration error. Contact administrator.' },
      { status: 500 }
    );
  }

  const tokenEndpoint = `https://studentportal.sydneyboys-h.schools.nsw.edu.au/oauth/token`;

  try {
    const tokenResponse = await axios.post(tokenEndpoint, null, {
      params: {
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // In a real application, you would store access_token and refresh_token securely (e.g., in a cookie)
    // For now, we'll just log them and redirect to the home page.
    console.log("Successfully obtained Access Token:", access_token);
    console.log("Refresh Token (if provided):", refresh_token);
    console.log("Expires In (seconds):", expires_in);

    // Redirect user back to the home page or a success page.
    return NextResponse.redirect(new URL('/', request.url)); // Redirect to your app's homepage

  } catch (error) {
    console.error('Error exchanging authorization code for token:', error.message);
    if (error.response) {
      console.error('SBHS Token API Response Status:', error.response.status);
      console.error('SBHS Token API Response Data:', error.response.data);
      if (error.response.status === 400 && error.response.data.error === 'invalid_grant') {
        return NextResponse.json(
          { error: 'Authorization code expired or invalid. Please try connecting again.' },
          { status: 400 }
        );
      }
    }
    return NextResponse.json(
      { error: 'Failed to obtain access token from SBHS Portal.' },
      { status: error.response?.status || 500 }
    );
  }
}