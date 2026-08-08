/**
 * GET /api/auth/callback
 *
 * Spotify redirects here after you authorize the app.
 * It exchanges the authorization code for access + refresh tokens,
 * then displays the refresh token so you can copy it into .env.local.
 *
 * You only need to do this ONCE.
 */
import { NextRequest, NextResponse } from "next/server";

/**
 * Escape user-controlled text before putting it in HTML.
 * Query params like ?error= come from the browser, so without this an
 * attacker could inject <script> tags into the page (XSS).
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(request: NextRequest) {
  // This is a one-time LOCAL setup tool (it prints a secret token in the
  // browser). It must never run on the live site.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  /* If the user denied access */
  if (error) {
    return new NextResponse(
      `<html><body style="background:#0a0a0c;color:#e8e6e3;font-family:monospace;padding:2rem;">
        <h1 style="color:#e05575;">Authorization Denied</h1>
        <p>Error: ${escapeHtml(error)}</p>
        <p><a href="/api/auth/login" style="color:#1e90ff;">Try again</a></p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return new NextResponse(
      `<html><body style="background:#0a0a0c;color:#e8e6e3;font-family:monospace;padding:2rem;">
        <h1 style="color:#e05575;">Missing Code</h1>
        <p>No authorization code received.</p>
        <p><a href="/api/auth/login" style="color:#1e90ff;">Try again</a></p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  /* Exchange the code for tokens */
  const client_id = process.env.SPOTIFY_CLIENT_ID!;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET!;
  const basic = Buffer.from(`${client_id}:${client_secret}`).toString("base64");

  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: "http://127.0.0.1:3000/api/auth/callback",
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    return new NextResponse(
      `<html><body style="background:#0a0a0c;color:#e8e6e3;font-family:monospace;padding:2rem;">
        <h1 style="color:#e05575;">Token Exchange Failed</h1>
        <p>Error: ${escapeHtml(String(tokenData.error))}</p>
        <p>${escapeHtml(String(tokenData.error_description || ""))}</p>
        <p><a href="/api/auth/login" style="color:#1e90ff;">Try again</a></p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  /* Success! Show the refresh token to copy */
  return new NextResponse(
    `<html><body style="background:#0a0a0c;color:#e8e6e3;font-family:monospace;padding:2rem;max-width:700px;">
      <h1 style="color:#1e90ff;">✅ Spotify Connected!</h1>
      <p style="color:#45d0c8;">Copy the refresh token below and send it to Claude:</p>
      <div style="background:#161619;border:1px solid #333338;border-radius:8px;padding:1rem;margin:1rem 0;word-break:break-all;">
        <code style="color:#4dacff;font-size:14px;">${escapeHtml(String(tokenData.refresh_token))}</code>
      </div>
      <p style="color:#9a9a9e;font-size:13px;">
        This token is stored in your .env.local file and lets the site fetch your
        Spotify data forever (unless you change your Spotify password or revoke the app).
        <br/><br/>
        You only need to do this once. After pasting the token, you can close this page.
      </p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
