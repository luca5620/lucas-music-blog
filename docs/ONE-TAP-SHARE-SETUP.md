# One-tap share to Instagram Stories + TikTok — setup, step by step

Written 2026-10-24 for Luca. **Facebook App ID (got it 2026-10-25): `3357751604411052`** (not a secret; it goes in the share URL). **What it does when done:** on a review's
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
   - **User data deletion** (Meta blocks Live mode without it): pick
     "Data deletion instructions URL" and paste
     `https://peakmusicreviews.com/privacy#delete-your-data`.
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

### TikTok status (2026-10-25)
- URL properties verified (privacy, terms, site root); the verification files were then removed (in git history if TikTok ever re-checks).
- The review form needs a **demo video of the working feature, made with the Sandbox client key** (the app has never been approved). So the order is: Sandbox tab → create sandbox → add Luca's TikTok account as a target user → copy the **sandbox Client key** → Claude builds Part 3 → MacBook build with the sandbox key → screen-record on the iPhone (start by opening the app, then review → Share → TikTok → TikTok editor opens with the video) → submit with the explanation text → after approval swap in the production key.
- Remove Login Kit / any scope we don't use before submitting (unused products delay review).

## Part 3 — the code (Claude) — DONE 2026-10-25

Team ID `82VZZ93GVV` (matches DEVELOPMENT_TEAM in the Xcode project).
TikTok **sandbox** client key `sbawg43ojzaf6kd4h2` is in Info.plist for now.

- [x] Share sheet (components/share/ReviewShareSheet.tsx): "Instagram
      story" + "TikTok" buttons, only when the installed app has the
      plugin AND that app is on the phone (lib/native.ts socialTargets).
      Scorecard tab → the scorecard video. Sticker tab → native photo
      picker for their own clip, sticker on top.
- [x] Native plugin `ios/App/App/SocialSharePlugin.swift` (registered in
      AppViewController.capacitorDidLoad in AppDelegate.swift; added to
      project.pbxproj next to SceneDelegate.swift):
  - Instagram: background video/photo + sticker PNG on the pasteboard,
    opens `instagram-stories://share?source_application=3357751604411052`.
    Clips over 20 s get cut to 20 s first.
  - TikTok: (sticker glued onto the clip with AVFoundation when they
    picked one) → saved to Photos → `TikTokShareRequest`.
- [x] TikTok SDK via CocoaPods (ios/App/Podfile: TikTokOpenSDKCore +
      TikTokOpenShareSDK, outside capacitor_pods so cap sync keeps them).
- [x] Info.plist: LSApplicationQueriesSchemes (instagram-stories,
      tiktokopensdk, tiktoksharesdk, snssdk1180, snssdk1233),
      TikTokClientKey, a URL type with the client key, photo strings.
- [x] Universal Link: App.entitlements has
      `applinks:peakmusicreviews.com`; the site serves
      /.well-known/apple-app-site-association claiming ONLY
      /share/tiktok-callback (everything else still opens in Safari).
      SceneDelegate/AppDelegate let TikTokURLHandler take its URL first.

## Part 4 — the MacBook build (Luca; Claude on the Mac helps)

1. `git pull`, then `npm install` and `npm run mobile:sync` (this runs
   `pod install`, which downloads TikTok's SDK and adds
   @capacitor/filesystem).
2. `npm run mobile:ios` opens Xcode.
3. **Signing & Capabilities** tab: check **Associated Domains** shows
   `applinks:peakmusicreviews.com` (it comes from App.entitlements).
   If Xcode shows a red signing error about it, click **Try Again** and
   let "Automatically manage signing" fix the profile.
4. **Product → Build**. If Swift errors appear, paste them to Claude —
   the plugin was written on Windows without a compiler.
5. Run on your **real iPhone** (plug it in, pick it as the target, ▶).
   Simulators don't have Instagram or TikTok.
6. Sign into TikTok on the phone with the account you added as the
   sandbox target user.

## Part 5 — the TikTok demo video (Luca, ~1 min)

1. iPhone Control Center → **Screen Recording** (add it in Settings →
   Control Center if it's not there). Start it, go to the home screen.
2. Tap the **Peak Music** icon (TikTok wants the video to start with the
   app opening).
3. Open one of your reviews → **Share** → **TikTok**.
4. Wait while the video is made (the bar fills). TikTok opens with it
   in the editor. Tap **Next** → post it (or save as a draft, either is
   fine), then come back to Peak Music.
5. Stop the recording. Upload it in the TikTok review form with the
   explanation text, and submit.
6. **After TikTok approves:** send Claude the **production** Client key.
   Info.plist's TikTokClientKey + URL scheme get swapped from the sandbox
   key, then a normal App Store build.

Before submitting the app to Apple: run the App Store rules check
(APP-STORE-RULES-WATCH.md) and add to the reviewer notes: "Share to
Instagram Stories / TikTok opens those apps with the user's own review
card; no login to those services."
