# Retention loops: what to measure, what to build, what not to do

The measured gap at Peak Music (2026-10-24): people sign up and rate once
(67% now do), but few come back (13 of 55 raters active on 2+ days). This
file is about the return visit.

## 1. Measure first: the growth model (Duolingo's tool, sized down)

Duolingo puts every user in exactly one bucket per day, and the arrows
between buckets are daily rates. Peak Music is too small for daily rates
to mean anything, so use **weekly** buckets (Zynga and MyFitnessPal, where
Duolingo borrowed the idea, used weekly rates too):

| Bucket | Definition (week = Mon–Sun, New York time like the recap) |
|---|---|
| New | Signed up this week |
| Current | Active this week AND active last week |
| Reactivated | Active this week, not last week, but within the last 4 weeks |
| Resurrected | Active this week after 4+ weeks away |
| At risk | Active last week, not this week |
| Dormant | Not active in 4+ weeks |

"Active" = did a real action: published a rating, commented, posted, voted
in Aux Wars, picked a song of the day. (Opening the app doesn't count.)

**The one number to watch:** *current-user retention* = of the people
active last week, the share active again this week. Duolingo's simulation
showed this lever moved daily users about 5x more than the next best,
because people who stay current keep compounding. It's harder to move but
it pays the most.

How to pull it: the anon-key REST trick (see `review-slug-bug` memory /
the 2026-10-24 measurement in ROADMAP.md) works for public tables:
`profiles.created_at`, published `reviews.user_id/created_at`, comments,
`aux_*` votes. Write the result into ROADMAP.md with the date, and pull
the same numbers again ~2 weeks after any retention change. **Measure,
don't guess.** The /start win was only provable because the baseline was
written down first.

## 2. What already exists at Peak Music (build on it, don't duplicate)

- **Song of the Day streak** with a flame icon and "streak at risk" text
  (`components/profile/StreakIndicator.tsx`, SOTD picker). This is the
  closest thing to Duolingo's streak.
- **Sunday recap push** (supabase function `push-recap`): "you rated N…".
- **Push notifications** for likes, follows, comments (push-fanout). The
  bell is the in-app version.
- **Release follows** and Friday release-day rooms.
- **Share cards** (scorecard video, sticker, month card).

## 3. Streaks: why they work, and the Peak Music version

Duolingo's insight: users who hit a 10-day streak dropped off far less
(they admitted part of that is selection bias). The motivation grows with
length: every day makes the next day matter more. Their biggest single
streak win was a **late-evening "streak saver" notification** sent before
the streak would break. Later: streak freeze, calendar view, animations,
rewards. Over four years the share of daily users with a 7+ day streak
nearly tripled to over half.

**Why it works there:** a lesson is 3–5 minutes and can be done every day.
**Does that reason exist here?** Rating an *album* daily: no. Nobody
finishes an album a day. Picking a *song of the day*: yes, that's the
daily-sized action, which is why the SOTD streak is the right streak to
invest in. A **weekly** streak fits album rating ("rated something 4 weeks
in a row"). Strava and Letterboxd-style diaries are weekly at heart too.

Peak Music moves, in order of cost:
1. **SOTD streak-saver push** at ~8pm local if today's pick is missing and
   the streak is 3+ days. One push, only for people with something to lose.
   (Biggest Duolingo win; cheapest here because SOTD + push already exist.)
2. **Streak freeze** that's earned, not bought (e.g. one per 7 days of
   streak). Duolingo sells them; selling them here would be an IAP (see
   web-monetization skill).
3. **Weekly rating streak** ("4 weeks in a row") shown on the profile and
   in the Sunday recap. Matches how people actually listen to albums.
4. **Friend streaks** (Duolingo: ~1 in 3 daily users has one). At Peak
   Music: "you and @x both rated something this week, 3 weeks running".
   Needs the social graph to be denser first (45 follows total on
   2026-10-24), so it's later.

Don't: make streaks punishing (losing a 60-day streak to a timezone bug
makes people quit), or put the streak in Luca's banned Ratings-app UI.

## 4. Notifications: protect the channel

Duolingo's rule, learned from Groupon burning out email by testing up to
five a day: teams could freely test **timing, copy, images, templates,
localisation**, but **sending more** needed strong justification and CEO
sign-off. A user who ignores a week of reminders stops getting them. Their
notifications are for *keeping* current users, and email does more of the
*reactivation* work.

For Peak Music:
- Every new push type needs a reason a user would be glad to get it.
  Social pushes (someone liked/commented/followed) are glad-to-get.
  "Haven't seen you in a while" is not.
- Cap: at most one non-social push per day; back off after 7 ignored days.
- Copy can be playful (Duo's passive-aggressive tone is the joke), but keep
  Luca's voice: laid-back, sentence case, no filler.
- iOS asks permission once. Ask at a moment of value ("get pinged when
  someone replies to your review"), not on first launch.
- Reactivation = email, if anywhere (Supabase auth emails exist; a
  marketing email needs an unsubscribe link and consent).

## 5. Leaderboards / leagues

Duolingo's leagues (borrowed from FarmVille 2, simplified): each week
you're grouped with ~30 people at a similar activity level; top finishers
move up a league. Opt-in by default, no extra tasks. Results: +17% learning
time, 3x the number of highly engaged learners, better D1/D7 retention.

**Does the reason exist here?** Leagues need enough weekly-active people to
fill a group of similar players. At ~13 multi-day actives, no. Revisit at
a few hundred weekly actives. Until then, a light version: "top raters this
week" on the community page, or a badge for most-rated week.

## 6. Recaps (Wrapped-style)

Spotify Wrapped, Duolingo Year in Review, Strava Year in Sport, Airbuds'
Weekly Recap. They spread because they're personal, look good, and have a
share button on every page. They also double as a **reactivation** moment:
people who went quiet come back to see theirs. Airbuds gates part of the
recap behind inviting friends ("see more than your top 3 artists").

Peak Music already has: Sunday recap push, month share card.
Next sizes up: a **year-end "Peak Music Rewind"** (December), built from
ratings data: top-rated album, most-played genre, hottest take (biggest gap
from the community average), taste-match twin. Every slide shareable with
the existing one-tap share sheet. Ship by early December, before Spotify
Wrapped soaks up attention. Each slide = a TikTok/Reel template too.
(This is a seasonal moment, not a parallel flow, so it doesn't break the
Quick-Rate rule. Still discuss before building.)

## 7. Social density: the multiplier

Airbuds: "the app only really works if you add your friends". Strava: people
in groups log 80–125% more activity than solo. Letterboxd: the follow feed
is the product. At Peak Music, 45 follows across ~100 accounts means most
feeds are empty. Ideas, from cheapest:
- Suggest follows right after the first rating ("3 people who rated this
  too").
- Taste-match % on profiles is already built. Surface "your closest taste
  twins" on /start's finish screen.
- Invite links that land on *your* review, with your scorecard as the
  preview image (the share link already does this).
- Don't build invite-gated features until there's a core loop worth gating.

## 8. Borrowing checklist (from Duolingo's two failures)

Before borrowing any mechanic, write down:
1. Why does it work in the source product? (Moves counter: Gardenscapes
   moves are strategic. Duolingo lessons aren't, so it was a nuisance.)
2. Does that reason exist at Peak Music? (Uber referral: reward was a free
   month of Plus, but Duolingo's best advocates already paid, so it only
   added 3% new users.)
3. What has to change to fit? (Leagues: they cut FarmVille's extra tasks
   and opted everyone in.)
4. What number will tell us it worked, and what was it before?

## Sources

- Jorge Mazal, "How Duolingo reignited user growth", Lenny's Newsletter:
  https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth
- Business Model Analyst, Duolingo marketing strategy (2026):
  https://businessmodelanalyst.com/duolingo-marketing-strategy/
- TechCrunch on Airbuds (2025-09-17):
  https://techcrunch.com/2025/09/17/airbuds-is-the-music-social-network-apple-and-spotify-wish-they-had-built/
- Strava Year in Sport coverage: https://insider.fitt.co/?p=5017
