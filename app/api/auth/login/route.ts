/**
 * GET /api/auth/login
 *
 * Redirects you to Spotify's authorization page.
 * You only need to visit this URL ONCE to get your refresh token.
 * After that, the refresh token is stored in .env.local and this route is no longer needed.
 */
import { NextResponse } from "next/server";

const SCOPES = [
  "user-read-currently-playing",
  "user-read-recently-played",
].join(" ");

export async function GET() {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: SCOPES,
    redirect_uri: "http://127.0.0.1:3000/api/auth/callback",
  });

  return NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params.toString()}`
  );
}
