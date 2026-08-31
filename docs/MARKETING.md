# Marketing — plan + ready-to-post drafts

*Started 2026-08-31, launch week. Owner: Luca. Current priority
(his call): SEO + proper Google indexing for organic traction; social
is announce-and-build; paid (Meta) is a later experiment.*

## Channels

| Channel | Role | Status |
| --- | --- | --- |
| SEO / Google | **Main growth engine** — organic search traffic | Sprints shipped (JSON-LD, sitemaps, comparison pages); indexing checklist below |
| Instagram — @peakmusicreviews | Home base: announce changes, feature community reviews/debates, general brand | Account created |
| LinkedIn (Luca's profile) | Launch announcement + builder-journey posts | Draft below, ready to post |
| Meta ads | Possible later, once organic baseline exists | Not yet — don't spend before retention is known |

## LinkedIn launch post (draft — edit voice to taste, then post)

> After months of building, Peak Music Reviews is live on the App
> Store. 🎉
>
> It's a social platform for music lovers — think Letterboxd, but for
> albums: rate anything on Spotify (plus the deep unreleased catalog),
> write reviews, build lists, and argue about it in live release-night
> rooms and two-sided debates. The whole thing is skinned like
> physical media — the site literally renders inside a CRT TV.
>
> Some things building it taught me:
> • One codebase, everywhere — the iOS app and the website ship from
>   the same deploy, so every improvement reaches everyone instantly.
> • A real catalog beats free text — every review is tied to an actual
>   release, imported on demand. Nothing hand-typed, nothing fake.
> • Community > content — live rooms and debates make release nights
>   an event, not a feed.
>
> It's free, and it works best with friends who have opinions about
> music (especially wrong ones).
>
> 📱 App Store: <APP STORE LINK>
> 🌐 peakmusicreviews.com
>
> If you try it, I'd genuinely love feedback — and if you know someone
> who never stops talking about album of the year, send it to them.

*(Fill in the App Store link. Optional: attach 2–3 screenshots — the
home CRT hero, a release-night live room, a profile — LinkedIn posts
with images travel further.)*

## Instagram — @peakmusicreviews

Role: the app's public announcement board + community showcase.
- **Launch post**: same story as LinkedIn, compressed — carousel of
  screenshots, caption ending with "link in bio".
- **Recurring formats** (low-effort, sustainable):
  - "New on Peak" — one slide per shipped feature, whenever something
    user-visible lands.
  - Community spotlights — a great review/list/debate (with the
    author's handle, ask first).
  - Release-day posts — "The new <artist> drops tonight — the live
    room opens at midnight" (this is the app's actual differentiator).
- Put the link in bio, keep the handle on the site footer eventually.
- Meta ads later would run from this account — another reason to keep
  it warm.

## SEO / Google indexing — the actual priority

Already live from earlier sprints: MusicAlbum/MusicGroup JSON-LD with
aggregateRating, breadcrumbs, per-page canonical + meta descriptions,
sitemap.xml + robots, /musicboard-alternative comparison page
(validated in GSC).

Checklist to work through now (mostly Google Search Console):
1. **GSC coverage report** — check Pages → "Why pages aren't indexed";
   chase anything sitting in "Discovered/Crawled – currently not
   indexed" (usually thin or duplicate-looking pages).
2. **Submit the sitemap** in GSC if not already, and re-submit after
   big content additions.
3. **Request indexing** manually for the money pages: home, /releases,
   /reviews, /musicboard-alternative, top release pages.
4. **Grow the indexable surface**: every release page that gains a
   review becomes a unique, rating-rich page — community growth IS the
   SEO flywheel. Releases with zero reviews are thin; consider
   noindex on empty release pages if GSC flags them.
5. **Watch the star snippets** — the Review/aggregateRating JSON-LD
   should start producing starred results; track impressions in GSC's
   Performance report weekly.
6. App Store ↔ site loop: the site's App Store badge + smart app
   banner help app installs ride the organic traffic.

## Later / parked
- Meta (IG/FB) ads — only after organic retention is understood;
  start tiny ($5–10/day), target music-community interests, drive to
  the App Store page.
- Muted on-site ads (ROADMAP Next up #6) — unrelated to marketing
  spend, revenue side, months away.
