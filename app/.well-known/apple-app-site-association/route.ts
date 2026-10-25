/**
 * /.well-known/apple-app-site-association — Apple's Universal Links file
 * (2026-10-25, one-tap TikTok share; docs/ONE-TAP-SHARE-SETUP.md).
 *
 * TikTok's Share Kit sends people back to the app through a normal
 * https link (SocialSharePlugin.tiktokRedirectURI). iOS only lets the
 * app catch that link if this file, on this domain, names the app —
 * Team ID 82VZZ93GVV + bundle ID com.peakmusicreviews.app — and the
 * app has the matching Associated Domains entitlement.
 *
 * It claims ONLY /share/tiktok-callback. Every other peakmusicreviews.com
 * link keeps opening in the browser exactly as before; claiming "/*"
 * would hijack every shared review link into the app.
 *
 * A route (not a file in public/) so it's served as application/json,
 * which Apple's CDN expects, with no redirect and no extension.
 */

export const dynamic = "force-static";

const APP_ID = "82VZZ93GVV.com.peakmusicreviews.app";
const PATH = "/share/tiktok-callback";

export function GET() {
  return Response.json(
    {
      applinks: {
        details: [
          {
            // iOS 13+ format…
            appIDs: [APP_ID],
            components: [{ "/": PATH }, { "/": `${PATH}/*` }],
            // …and the older one, which iOS still reads.
            appID: APP_ID,
            paths: [PATH, `${PATH}/*`],
          },
        ],
      },
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
