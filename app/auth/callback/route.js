// app/auth/callback/route.js
import { NextResponse } from 'next/server';

// Delegate token exchange to the API route to avoid duplication and env drift
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const redirect = new URL(`/api/auth/callback?code=${encodeURIComponent(code || '')}&state=${encodeURIComponent(state || '')}`, request.url)
  return NextResponse.redirect(redirect.toString())
}