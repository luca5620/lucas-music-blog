# Apple and EU rules for ads and supporters (checked 2026-10-25)

Quoted from the live App Review Guidelines (developer.apple.com,
fetched 2026-10-25). Re-check before building; see
docs/APP-STORE-RULES-WATCH.md. The 2026-10-16 update (Luca's screenshot of
Apple's email: 1.2 clarified, new 2.3.14 creative assets, new 2.5.19
hidden features, 3.1.1(a) link entitlements reworded, 5 clarified) is
already logged there.

## Why "website only" is the right call

The app is a Capacitor shell that loads the live site, so **anything on
the site is in the app unless the code hides it**. If ads or a supporter
purchase show up in the app:

- **2.5.18 (ads):** ads must suit the age rating, let the user see the
  targeting info in the app, interstitials need a clear close button, and
  "apps that contain ads must also include the ability for users to report
  any inappropriate or age-inappropriate ads". Also App Privacy labels
  change (tracking/advertising data) and possibly App Tracking
  Transparency.
- **3.1.1 (IAP):** "If you want to unlock features or functionality within
  your app… you must use in-app purchase." Tips are allowed only "using
  in-app purchase currencies".
- **3.1.1(a) / 3.1.3:** outside the **United States storefront**, apps may
  not include "buttons, external links, or other calls to action that
  direct customers to purchasing mechanisms other than in-app purchase".
  (US storefront: allowed since 2025.) Peak Music is live in EU
  storefronts too, so a "Support on Ko-fi" button in the app would break
  this for non-US users.
- **EU DSA trader status:** monetising the app means declaring as a trader
  (public address/phone/email on the listing). Website-only revenue keeps
  the app non-commercial. (Luca's call, 2026-10-25.)

So: **gate every ad and every support link with `isNativeApp()`**.

## The grey zone: showing the checkmark inside the app

3.1.3(b) Multiplatform Services: apps "may allow users to access content,
subscriptions, or features they have acquired… on your web site…
provided those items are also available as in-app purchases within the
app."

A supporter checkmark bought on the web and *displayed* in the app is
arguably a feature acquired on the web. Risk assessment:
- It unlocks no functionality and is recognition other users see, like a
  role badge. Reviewers rarely act on cosmetic badges with no purchase
  path in the app. Discord, Reddit and Twitch show web-bought badges in
  their apps, though they also sell them in-app.
- Lowest-risk setup: in the app, show the checkmark (it's someone else's
  profile decoration), but no price, no "get this" link, and no "become a
  supporter" copy anywhere. Its tooltip says "Supports Peak Music", with
  nothing tappable.
- If Apple ever objects: either add a matching IAP (needs EU trader status
  first) or hide supporter checkmarks in the app (CSS/`isNativeApp()`), a
  website-only fix with no new build.

Mention it in the next App Review notes only if asked; never hide features
from review (2.5.19). Supporter badges are visible, documented features.

## Fundraising wording

3.2.2(iv): collecting funds "for charities and fundraisers" inside an app
needs an approved nonprofit. Peak Music isn't fundraising for a cause; it's
tips to the developer. Avoid "donate/donation" in copy for this reason too.

## Other ad and privacy rules on the web side

- Google AdSense needs a certified CMP for EEA/UK/CH traffic (see ads.md).
- GDPR: the privacy policy must list ad vendors, cookies and opt-outs.
  Supabase is in us-west-1 (already disclosed for the EU launch).
- Ads must suit the app's age rating (check App Store Connect for the current one).

## Sources

- https://developer.apple.com/app-store/review/guidelines/ (3.1.1,
  3.1.1(a), 3.1.3, 3.1.3(b), 2.5.18, 3.2.1(vi), 3.2.2)
- https://developer.apple.com/news/?id=3ozbk628
- docs/APP-STORE-RULES-WATCH.md (repo log)
