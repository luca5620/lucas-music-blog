# Google + Apple sign-in — the setup that isn't code

The code is done and deployed. The buttons stay **hidden** until you
finish the steps below and flip one Vercel env var, so nothing can
break for real visitors in the meantime.

Callback URL used everywhere below (Supabase's, not ours):

```
https://qhbtfhyzbiwqwaxtetgd.supabase.co/auth/v1/callback
```

---

## 0. Supabase — allow our redirect (once, for both providers)

Supabase Dashboard → **Authentication → URL Configuration**

- Site URL: `https://peakmusicreviews.com`
- Redirect URLs — add all three:
  - `https://peakmusicreviews.com/auth/callback`
  - `http://localhost:3000/auth/callback` (for `npm run dev`)
  - `com.peakmusicreviews.app://auth/callback` — **the app.** Not a
    typo and not a website: it's the custom URL scheme iOS/Android use
    to hand the signed-in session back to the shell. Paste it exactly;
    no trailing slash, no wildcard. Without it the app's buttons open
    Safari and come back to a Supabase error page. Google and Apple
    never see this URL — they only ever know the Supabase callback at
    the top of this doc — so nothing changes on their end.

---

## 1. Google (the easy half, ~15 minutes)

1. [console.cloud.google.com](https://console.cloud.google.com) → create
   a project (or reuse one).
2. **APIs & Services → OAuth consent screen**
   - User type: **External**, then **Publish** the app (while it's in
     "Testing" only accounts you list can sign in).
   - App name: Peak Music Reviews. Developer contact email (free
     text): `contact@peakmusicreviews.com`. **User support email is a
     dropdown**, not free text — it only offers the signed-in Google
     account or a Google Group you own, so unless contact@ is a
     Workspace account there, pick the personal gmail and put
     contact@ in the developer field.
   - Links to `https://peakmusicreviews.com/privacy` and `/terms` —
     Google shows them on the consent screen.
   - **Skip the logo** on the first pass: uploading one can trigger
     Google's brand verification review (weeks), and without it the
     consent screen just shows the app name. Add it later if wanted.
   - Scopes: the default `email`, `profile`, `openid` — nothing else,
     so the app needs no Google verification review.
3. **APIs & Services → Credentials → Create credentials → OAuth client
   ID → Web application**
   - Authorized JavaScript origins: `https://peakmusicreviews.com`
   - Authorized redirect URIs: the Supabase callback URL at the top.
   - Copy the **Client ID** and **Client secret**.
4. Supabase Dashboard → **Authentication → Providers → Google** →
   enable, paste both, save.

## 2. Apple (the fiddlier half, ~30 minutes, needs the paid developer
account you already have)

At [developer.apple.com](https://developer.apple.com) → Certificates,
Identifiers & Profiles:

1. **Identifiers → your App ID** (the iOS app's bundle ID) → edit →
   tick **Sign in with Apple** → Save.
2. **Identifiers → + → Services IDs** → description "Peak Music
   Reviews Web", identifier something like
   `com.peakmusicreviews.web` (it can't equal the app's bundle ID).
   - Tick **Sign in with Apple** → **Configure**:
     - Primary App ID: the App ID from step 1.
     - Domains and Subdomains: `qhbtfhyzbiwqwaxtetgd.supabase.co`
     - Return URLs: the Supabase callback URL at the top.
3. **Keys → +** → name it, tick **Sign in with Apple**, configure it
   against the same primary App ID → Continue → Register → **Download
   the `.p8` file** (one download, ever — keep it somewhere safe).
   Note the **Key ID**, and your **Team ID** (top right of the
   developer portal).
4. Supabase Dashboard → **Authentication → Providers → Apple** →
   enable and fill in:
   - **Client IDs**: the Services ID from step 2
     (`com.peakmusicreviews.web`). If native iOS sign-in is ever
     added, the app's bundle ID goes in this same list, comma
     separated.
   - **Secret Key**: Apple doesn't give you one — you mint it as a
     JWT from Team ID + Key ID + the `.p8`. Run:

     ```bash
     node scripts/apple-secret.mjs --team TEAMID --key-id KEYID        --client-id com.peakmusicreviews.web --p8 "path/to/AuthKey_KEYID.p8"
     ```

     It signs locally with node's crypto (never paste a `.p8` into a
     random "Apple JWT generator" site) and prints the token to paste.

⚠️ **Apple's secret expires every 6 months** — that's Apple's hard cap,
not a choice. When Apple sign-in suddenly stops working, this is why:
re-run `scripts/apple-secret.mjs` with the same `.p8` and paste the new
token into Supabase. Worth a calendar reminder the day you set it up.

---

## 3. Turn the buttons on

Vercel → Project → Settings → **Environment Variables**:

```
NEXT_PUBLIC_SOCIAL_LOGIN = google,apple
```

Use `google` alone if you want to ship Google first and do Apple
later. It's a `NEXT_PUBLIC_` var, so **redeploy** after setting it.

---

## What happens on a first social sign-in

1. Button → provider → Supabase → `/auth/callback` (session cookies
   set here).
2. The signup trigger has already made a profile with an **invented**
   username (Apple gives us a `@privaterelay.appleid.com` address, so
   it's usually gibberish) and flagged it `username_auto`.
3. Because of that flag the callback sends them to **`/welcome`**:
   pick a real handle + tick the Terms box (App Store 1.2 wants
   active agreement, and a social signup never saw the signup form).
   That first handle claim is **free** — it doesn't start the 14-day
   username cooldown.
4. Everyone else lands straight where they were going.

**Migration `031-social-login.sql` must be run in the SQL Editor** for
step 2/3 to work. Without it the flag column doesn't exist, the
callback just carries on, and social users keep the invented handle
(which they can still change in settings — it just costs them their
one change per fortnight).

## Notes

- **Same email, both doors**: someone who signed up with
  `you@gmail.com` and a password, then hits "Continue with Google"
  with that same address, gets linked to the existing account —
  Supabase links identities when the provider has verified the email.
- **The app does this too, from the 1.1 build on.** Inside the shell
  the site runs in a WKWebView and Google rejects OAuth in embedded
  webviews (`disallowed_useragent`), so the app can't just navigate
  to the provider. Instead `OAuthButtons` opens the provider page in
  SFSafariViewController (`@capacitor/browser`), Supabase comes back
  to `com.peakmusicreviews.app://auth/callback`, and the App plugin's
  `appUrlOpen` fires inside the WebView, where the PKCE verifier and
  the session cookies live. Both providers ship together, which is
  what App Store guideline 4.8 wants anyway.
- **Old app builds stay on email/password, on purpose.** The shell
  loads the live site, so this deploy also reaches phones running the
  1.0 binary — which has no Browser plugin and no registered URL
  scheme. The buttons are gated on the plugin actually being there
  (`browserPlugin()` in `lib/native.ts`), so 1.0 shows exactly what
  it shows today and 1.1 arms itself on install. Nothing to toggle.
- **Apple's relay addresses forward mail**, so notification email
  still reaches those users through Resend as normal.
