# Shipping the iOS app from your MacBook Pro

Everything in this guide happens on the Mac. The Windows machine already
did its part — the native Xcode project is committed to this repo at
`ios/`, and the app is a native shell that loads the live site, so **web
deploys update the app instantly without App Store re-review**.

---

## 0. One-time Mac setup (~30 min, mostly downloads)

1. Install **Xcode** from the Mac App Store (big download, start it first).
2. Open Xcode once → accept the license → let it install iOS components.
3. Install Homebrew if you don't have it: https://brew.sh
4. Install Node 20+ and git: `brew install node git`
5. (Optional but recommended) Install Claude Code to keep working with
   Claude on the Mac: `npm install -g @anthropic-ai/claude-code` — then
   run `claude` inside the repo folder. The whole project context lives
   in the repo, so Claude picks right up.

## 1. Get the project

```bash
git clone https://github.com/luca5620/lucas-music-blog.git
cd lucas-music-blog
npm install
npx cap sync ios
```

You do NOT need `.env.local` for the iOS build — the app loads the
live site, and secrets stay on Vercel.

## 2. Apple Developer account ($99/year)

1. Go to https://developer.apple.com/programs/enroll/
2. Sign in with your personal Apple ID → enroll as an **Individual**.
3. Pay the $99/year. Approval usually takes **24–48 hours** — do this
   before anything else and let it cook.

## 3. Open and sign the app

```bash
npx cap open ios
```

That opens Xcode with the project. Then:

1. Click **App** in the left sidebar → **Signing & Capabilities** tab.
2. Check **Automatically manage signing**.
3. **Team**: pick your Apple Developer team (appears once enrolled).
4. **Bundle identifier**: keep `com.peakmusicreviews.app`.

## 4. Run it on YOUR iPhone (same day, no App Store needed)

1. Plug your iPhone into the Mac with a cable.
2. On the phone: tap **Trust This Computer**.
3. In Xcode's top bar, select your iPhone as the run target.
4. Press **▶ (Run)**. First time: on the phone go to
   Settings → General → VPN & Device Management → trust your developer
   certificate.

PEAK is now on your home screen. This alone gets you "working on my
iPhone this week" even while App Review is pending.

## 5. App Store submission

### App icon
Xcode needs a 1024×1024 icon with **no transparency**. In Xcode:
App → Assets → AppIcon → drag the PNG in (use the penguin logo on the
`#060607` background; ask Claude on the Mac to generate the exact sizes
if needed).

### Archive & upload
1. In Xcode select target **Any iOS Device (arm64)**.
2. Menu: **Product → Archive**.
3. When the Organizer opens: **Distribute App → App Store Connect →
   Upload** (defaults are fine).

### App Store Connect (https://appstoreconnect.apple.com)
1. **My Apps → + → New App**: platform iOS, name **PEAK — music social
   network** (or just PEAK if free), bundle id `com.peakmusicreviews.app`,
   SKU `peak-001`.
2. Fill in: description, keywords (music, reviews, albums, social,
   letterboxd, rate), support URL (peakmusicreviews.com), screenshots
   (run the app in Xcode's iPhone simulator → Cmd+S saves screenshots;
   you need 6.7" and 6.5" sizes).
3. **App Privacy**: data collected = email address + user content
   (reviews/comments), linked to identity, not used for tracking.
4. Age rating questionnaire → likely 12+ (user-generated content).
5. Select the build you uploaded → **Submit for Review**.

Review typically takes 1–2 days. If Apple rejects with "4.2 minimum
functionality" (web-wrapper complaint), reply pointing out native
haptics, share sheet, offline handling — and consider adding push
notifications (ask Claude; it's the single strongest fix).

### TestFlight (optional but great)
The same uploaded build can go to **TestFlight** instantly — install the
TestFlight app on your phone, add yourself as an internal tester, and
you get the real App-Store-signed app before review even finishes.

---

## Android / Google Play (from the Mac too)

The `android/` project is also committed. Reality check: since 2023,
**new personal Play accounts must run a closed test with 12 testers for
14 days** before they can publish publicly, so Play is a slower burn.

1. Play Console account ($25 one-time): https://play.google.com/console
2. Install Android Studio, open the `android/` folder, let Gradle sync.
3. Build → Generate Signed App Bundle (create a keystore; BACK IT UP —
   lose it and you can never update the app).
4. Play Console → create app → upload the .aab to **Closed testing** →
   recruit 12 testers (friends/Discord) → after 14 days apply for
   production.

---

## Day-to-day after launch

- Website changes: just `git push` — Vercel deploys, both apps update
  instantly. No store review needed.
- Native shell changes (rare — new plugins, icon, splash): bump the
  version in Xcode, re-archive, re-upload, re-review.
