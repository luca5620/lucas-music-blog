/**
 * /share/tiktok-callback — where TikTok sends people after sharing a
 * review (2026-10-25). Inside the app, iOS hands this link straight to
 * the app (Universal Link, see app/.well-known/apple-app-site-association)
 * and this route never runs. It only runs if the link opens in a
 * browser instead — then it just goes to the home page.
 */
export function GET(request: Request) {
  return Response.redirect(new URL("/", request.url), 302);
}
