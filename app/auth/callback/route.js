// app/auth/callback/route.js
import { NextResponse } from 'next/server';

// Delegate token exchange to the API route and forward the full search string
export async function GET(request) {
  const url = new URL(request.url)
  const search = url.search || ''
  const redirect = new URL(`/api/auth/callback${search}`, request.url)
  return NextResponse.redirect(redirect.toString())
}