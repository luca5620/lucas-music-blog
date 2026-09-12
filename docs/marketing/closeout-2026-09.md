# Marketing close-out (September 2026)

Luca, 2026-09-09: after today the marketing plan closes on three
channels — **Reddit, Instagram, reviewer/reactor emails** — and the
work moves to the app itself and the solo experience. Meta ads are
closed for now. TikTok comes later and his friends run it.

This file is the checklist for closing the three. Each line says whose
hands.

## Reviewer / reactor emails

Kit: `docs/marketing/reviewer-outreach.md` (targets, four emails, a
follow-up, the pre-send walk, the reply playbook).

- [ ] Luca: profile stocked to 40+ ratings via the review form loop
- [ ] Luca: two or three albums with every track rated (the release link)
- [ ] Luca: pull the four business emails from the channels' About pages
- [ ] Luca: send all four in one sitting; log them in the send table
- [ ] Luca: one follow-up each at seven days if no reply
- [ ] Claude: fix anything they report the same day

## Instagram

Doc: `docs/marketing/instagram-batch-1.md`. Nine posts written; week 1
posted; weeks 2 and 3 are shoots, not writing.

- [ ] Luca: the week-2 six-shot sitting (doc §"Week 2 — shoot list")
- [ ] Luca: post 4 (debates), 7 (small artists), 6 (Your Taste) this week (2026-09-11: all images generated, penguin mascot in 5 and 7 — Antarctica for 7)
- [ ] Luca: post 5 (profile themes) the week after — the penguin-from-behind image came out wrong, regenerate with the post-5 prompt
- [ ] Post 8 (Android testers) only if the Play test is still wanted —
      it's a recruitment post, it can wait indefinitely
- [ ] Post 9 (the room after Pylon) — 18 September, can't be made early
- [ ] Claude: captions and hashtags are done; nothing owed until a shot
      comes back

## Reddit

Plan (ROADMAP, 2026-09-02): r/Musicboard ✅ posted, then **r/iosapps**,
**r/androidapps** (the testers ask), **r/SideProject**. r/music is off.
r/shareyourmusic is comment work only.

Standing lesson from the r/Musicboard thread: **never make a
falsifiable claim about a competitor.** None of the drafts below name
one. Lead with what only we have.

Both drafts below are Luca's voice, builder-to-users, no marketing
words. Check each sub's posting rules and required flair on the day —
they change. Attach two real screenshots (the release page with TRACK
RATINGS open, and your profile), no AI plates on Reddit.

### r/iosapps — draft

**Title:** Peak Music Reviews — rate any album or song 0–10, leaks and
unreleased records included (free, iOS + web)

**Body:**

I made a music rating app. The short version:

- Every album and song is a real catalog entry — pulled from Spotify
  and Genius the first time someone rates it. Nothing hand-typed, so
  nothing misspelled.
- Unreleased and leaked records are in the catalog too, tagged
  UNRELEASED. You can rate the Carti leaks the same way you rate the
  album.
- Ratings are 0–10 with a decimal. You can rate every track on a
  record individually, or the whole thing, or both. Writing a review
  is optional.
- Release nights have a live room on the release page that opens
  before the drop.
- Profiles are the point: your rating history, a histogram, four
  favorites, your theme.

Free, no ads. Web works without an install; the iOS app is on the App
Store. [link]

Happy to answer anything about how it's built.

### r/SideProject — draft

**Title:** I built a music rating site where unreleased and leaked
tracks are real catalog entries, not comment threads

**Body:**

Peak Music Reviews — rate albums and songs 0–10, keep a profile that's
your rating history.

The part I'm proud of: the catalog is never hand-typed. The review form
searches Spotify and Genius, and the release gets created in the
database the first moment someone rates it. That's also how unreleased
and leaked records get in — Genius carries them, so a leak is a real
entry with a real tracklist, and you can rate it like anything else.

Stack, since this sub asks: Next.js on Vercel, Supabase with
row-level security as the actual boundary (the app only ever holds
the anon key), the iOS app is a Capacitor shell loading the live site,
so a push to main updates the app. Six languages. Solo project.

What's next is the solo experience — I want a profile to be a page
you'd link in a bio.

[link] — web works without an install.

### r/androidapps — draft (only if the Play test is still wanted)

**Title:** Android build of my music rating app is done — Google Play
wants a closed-test group before it goes public. Want in?

**Body:**

Peak Music Reviews: rate any album or song 0–10, unreleased and leaked
records included, profiles that are your rating history. It's live on
web and iOS. The Android build is finished, and Google Play requires a
group of testers for 14 days before a public listing.

If you're on Android and want the app before it's public, comment or
DM and I'll send the test link. You get it early; I get to launch.

[web link so people can see what it is first]

## Closed

- **Meta ads** — closed for now (Luca, 2026-09-09). Don't re-pitch.
- **TikTok** — later, friends run the account with their own ideas.
  Luca stays off camera. Nothing to prepare until they start.
