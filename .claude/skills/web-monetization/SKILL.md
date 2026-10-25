---
name: web-monetization
description: How Peak Music Reviews makes money without breaking Apple's rules or the community — website-only display ads (AdSense → Journey → Mediavine/Raptive ladder, consent, ads.txt, placement, Core Web Vitals), a supporter/donator checkmark (Ko-fi or Stripe → role badge), opt-in rewarded ads, and the Apple 3.1.1 / 3.1.3(b) / 2.5.18 traps of a Capacitor app that loads the live site. Use this skill whenever the task touches ads, donations, tips, supporter badges, subscriptions, paywalls, pricing, revenue, costs, the EU trader question, or anything that takes money — before building anything.
---

# Web monetization — the Peak Music plan

Luca's plan (2026-10-25): **ads on the website only at first, plus a
donations area where people get a donator checkmark. Subscriptions and
other monetization later.** He chose website-only to stay a non-trader in
the EU App Store (the app itself stays non-commercial).

Before building any of it: run the App Store rules check
(`docs/APP-STORE-RULES-WATCH.md`, CLAUDE.md requires it for payments).

## Be honest about the money first

At ~30 Google clicks a week plus direct/app traffic, display ads earn
**cents to a few dollars a month**. Typical small-site AdSense RPM is a
few dollars per 1,000 pageviews. Ads don't cover Vercel ($20/mo) until
traffic is roughly 10x today's. Supporters can: 5 people at $3 is more
than months of ads at this size. So build the **supporter checkmark
first** and treat ads as groundwork that grows with SEO. Say this plainly
if asked (the `free-tier-diagnosis-rule` memory: name the real ceiling).

## How to use this skill

| Task | Read |
|---|---|
| Ads: networks, approval, consent, ads.txt, placement, hiding in the app, rewarded ads | `references/ads.md` |
| Supporter / donator checkmark, payment providers, webhook → badge, wording, taxes | `references/supporters.md` |
| Apple rules for all of the above (the traps) | `references/apple-and-eu.md` |

## Non-negotiables

1. **The iOS/Android app shows no ads and no "donate" buttons or links.**
   The app loads the live site, so every money element must be gated on
   `isNativeApp()` (lib/native.ts) and render nothing in the shell. This keeps
   Apple 2.5.18 (ad rules), 3.1.1 (IAP) and 3.1.3 (no steering outside the
   US) out of play, and keeps the EU listing non-trader.
2. **Never paywall core features** (rating, reviewing, lists, Aux Wars,
   rooms). Supporter perks are cosmetic/recognition only.
3. **No dark patterns.** No ads disguised as content, no fake close
   buttons, no manipulative "revive" offers (see the Block Blast reference
   video in the growth-marketing skill: that's what *not* to do). Ads must
   be clearly labeled.
4. **Honest wording:** "Support Peak Music" / "Supporter", not "donate" or
   "donation". Peak Music isn't a registered charity; "donation" implies
   one (and Apple 3.2.2(iv) treats charity fundraising separately).
5. **Performance budget:** ads must not undo the CLS 0 work. Reserve space
   for every slot; lazy-load below the fold; respect Low detail mode.
6. **Design:** ad slots should look like part of the physical-media world
   (a labelled "sponsor" VHS sticker frame), never a generic web banner
   dropped over the CRT shell. Ask Luca before final placement.
