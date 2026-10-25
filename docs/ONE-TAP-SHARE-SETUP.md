# One-tap share to Instagram Stories + TikTok — setup, step by step

Written 2026-10-24 for Luca. **What it does when done:** on a review's
Share sheet, you tap "Instagram Story" or "TikTok", pick a clip from
your camera roll (or use the card's own video), and the app opens
straight into Instagram / TikTok with everything already in place.

- **Instagram Stories:** your clip is the background, and the review
  sticker sits on top as a real Instagram sticker you can move, resize
  and add music to. This is the good one.
- **TikTok:** TikTok has no "sticker on top" door for other apps, so
  the phone glues the sticker onto your clip first, then hands TikTok
  the finished video. You land in TikTok's editor with it.

It needs a **new native build** (1.3 or later), so it ships with the
next TestFlight / App Store round, not instantly like website changes.

App Store rules: checked 2026-10-24 (docs/APP-STORE-RULES-WATCH.md).
Opening Instagram / TikTok with the user's own content is normal and
allowed. The only extra is the photo-library permission line, and we
already have one (`NSPhotoLibraryUsageDescription`).

---

## Part 1 — Instagram: get a "Facebook App ID" (Luca, ~10 min, on any computer)

Instagram refuses shares from apps that don't send this number. You
get the error "The app you shared from doesn't currently support
sharing to Stories". It's free and not a secret.

1. Go to **developers.facebook.com**. Log in with your Facebook account.
   (If it asks you to "register as a developer", say yes and confirm
   your phone/email. That's a one-time thing.)
2. Top right, click **My Apps**, then **Create App**.
3. It asks what the app is for. Pick the plainest option. If you see
   "Other", pick that. If it then asks for an app type, pick
   **Consumer** (or "None" if that's offered). Don't add any products
   like Login or Ads; we need none of them.
4. App name: **Peak Music**. Contact email: yours. Click Create
   (it may ask for your Facebook password again).
5. In the left menu go to **App settings → Basic**.
   - At the top you'll see **App ID**, a long number like
     `1234567890123456`. **Copy it and paste it to Claude.** That's
     the only thing needed from Meta.
   - While you're on this page, fill in **Privacy Policy URL**:
     `https://peakmusicreviews.com/privacy` and **Terms of Service
     URL**: `https://peakmusicreviews.com/terms`. Pick a category
     (Music / Entertainment). Save changes.
6. Scroll to the bottom → **+ Add platform → iOS**. Bundle ID:
   `com.peakmusicreviews.app`. Save.
7. At the top of the dashboard there's an **App mode: Development /
   Live** switch. Flip it to **Live** if it lets you (it needs step 5
   done). If it won't, that's OK for now: test first, and if friends
   get the "doesn't support sharing" error, Live mode is the fix.

Don't paste the **App Secret** anywhere. We don't need it.

## Part 2 — TikTok: a developer app with Share Kit (Luca, ~15 min + their review wait)

1. Go to **developers.tiktok.com**. Log in with your TikTok account.
2. Click **Manage apps** (top right, under your profile) → **Connect an
   app** / **Create app**. If it asks for an organization or
   individual, pick **individual** (unless you have a company set up).
3. Fill in the app details:
   - App name: **Peak Music**, icon: the App Store icon.
   - Category: Entertainment (or Music if listed).
   - Description, plain words: "Peak Music Reviews is a music review
     app. Share Kit lets people post their review as a video to
     TikTok."
   - Terms of Service URL: `https://peakmusicreviews.com/terms`.
     Privacy Policy URL: `https://peakmusicreviews.com/privacy`.
   - Platform: **iOS**. Bundle ID `com.peakmusicreviews.app`. App
     Store URL: the Peak Music App Store link.
4. Click **+ Add products** → add **Share Kit**. (Not Login Kit, not
   Content Posting API; we only need Share Kit.)
5. Submit it for review. TikTok checks it by hand, which usually takes a
   few days. If they ask for a demo video, Claude can make one once
   the feature is built (it works for your own TikTok account before
   approval in most cases; if not, we wait).
6. When it's approved, open the app's page and find **Client key**.
   **Copy it and paste it to Claude.** Never paste the **Client
   secret**. Share Kit doesn't use it.

## Part 3 — the code (Claude, on Windows, ships with the website)

Claude does these. Listed so the MacBook session knows the state.

- [ ] Share sheet: "Instagram Story" + "TikTok" buttons, shown only in
      the app build that has the native side (older builds keep plain
      Share). Option to pick a clip from the camera roll, or use the
      card's own video.
- [ ] Sticker export: the review card as a transparent PNG sticker
      (Instagram) and "clip + sticker glued together" as an MP4
      (TikTok). Instagram limits: background video H.264, up to 20 s,
      under 50 MB.
- [ ] Universal link for TikTok's "come back to the app" step: a
      `/.well-known/apple-app-site-association` file on
      peakmusicreviews.com (needs your Apple **Team ID**, the 10-letter
      code at developer.apple.com → Membership).
- [ ] A small native plugin (`ios/App/App/SocialSharePlugin.swift`):
  - Instagram: put the background video and sticker on the pasteboard
    (`com.instagram.sharedSticker.backgroundVideo`,
    `com.instagram.sharedSticker.stickerImage`) and open
    `instagram-stories://share?source_application=<App ID>`.
  - TikTok: save the MP4 to Photos, then send a `TikTokShareRequest`
    (TikTok's `TikTokOpenShareSDK`) with that video.

## Part 4 — the MacBook build (Luca + Claude on the Mac)

1. `git pull`, then `npm install` and `npm run mobile:sync`.
2. `npm run mobile:ios` opens Xcode.
3. Xcode → **File → Add Package Dependencies…** → paste
   `https://github.com/tiktok/tiktok-opensdk-ios` → "Up to Next Major
   Version" → tick **TikTokOpenSDKCore** and **TikTokOpenShareSDK**
   → Add.
4. Info.plist (Claude will have committed these, just check they're
   there): `LSApplicationQueriesSchemes` contains `instagram-stories`,
   `tiktoksharesdk`, `snssdk1180`, `snssdk1233`. Also `TikTokClientKey`
   = the client key, and a URL type whose scheme is the client key.
5. Xcode → App target → **Signing & Capabilities → + Capability →
   Associated Domains** → add `applinks:peakmusicreviews.com`.
6. Run on the Duo simulator for a smoke test. The real test needs a
   real iPhone with Instagram + TikTok installed (simulators don't have
   them), via TestFlight.
7. Before submitting: run the App Store rules check again
   (APP-STORE-RULES-WATCH.md) and mention in the reviewer notes:
   "Share to Instagram Stories / TikTok opens those apps with the
   user's own review card; no login to those services."

## What Claude needs from Luca, in one line

The **Facebook App ID** (Part 1, step 5), the **TikTok Client key**
(Part 2, step 6, after their approval) and your **Apple Team ID**.
