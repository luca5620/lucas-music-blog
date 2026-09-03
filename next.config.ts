import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

// LANGUAGES — points next-intl at the per-request locale resolver
// (cookie → Accept-Language → English). Design notes in i18n/config.ts.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * Security headers applied to every response.
 * These are defense-in-depth: even if a bug slips in elsewhere (e.g. an XSS
 * vector), these headers limit what an attacker can do with it.
 */
const securityHeaders = [
  // Force HTTPS for a year once a browser has seen the site over HTTPS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Never let the browser "sniff" a response into a different content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't allow the site to be embedded in iframes (clickjacking protection).
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin (not full URLs) to other sites we link out to.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // We don't use camera/mic/geolocation — say so explicitly.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Content Security Policy:
  // - scripts only from our own origin ('unsafe-inline'/'unsafe-eval' are
  //   required by Next.js hydration and dev tooling)
  // - images from anywhere over https (album art comes from Spotify's CDN)
  // - audio/media over https (profile songs, previews)
  // - network calls to our origin + Supabase + Spotify
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.spotify.com https://accounts.spotify.com",
      // Video embeds (Your Taste + posts). YouTube: nocookie is the
      // privacy-enhanced player, www.youtube.com covers player-internal
      // redirects. TikTok: the iframe player lives at www.tiktok.com.
      // Spotify: the /embed/... preview player on release pages.
      "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://www.tiktok.com https://open.spotify.com https://embed.music.apple.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  /**
   * IndexNow ownership file (docs/AI-SEARCH.md, 2026-09-03). Bing
   * verifies our pings by fetching https://peakmusicreviews.com/<key>.txt;
   * the key is an env var, not a committed file, so the path is
   * rewritten to the route that serves it. process.env is read at
   * BUILD time here — a new key needs a redeploy to take effect,
   * which Vercel does on any env change. No key = no rewrite.
   */
  async rewrites() {
    const key = process.env.INDEXNOW_KEY?.trim();
    if (!key || !/^[a-zA-Z0-9-]{8,128}$/.test(key)) return [];
    return [{ source: `/${key}.txt`, destination: "/api/indexnow/key" }];
  },
};

/**
 * Sentry wrapper (error tracking, 2026-08-25). Two jobs:
 * - tunnelRoute: browser error reports POST to our own /monitoring
 *   path and Vercel forwards them to Sentry — same-origin, so the
 *   strict CSP above needs no new hosts and ad-blockers can't eat
 *   the reports.
 * - source-map upload at build time, so Sentry shows real component
 *   names instead of minified goo. Only happens when SENTRY_AUTH_TOKEN
 *   is set (Vercel env); without it the build just skips the upload.
 */
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true, // keep build logs readable
  tunnelRoute: "/monitoring",
  disableLogger: true, // strips Sentry's debug logger from the bundle
  telemetry: false,
});
