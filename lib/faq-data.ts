/**
 * FAQ Data — Structured FAQ content for schema markup.
 *
 * These FAQs are rendered as JSON-LD on their respective pages
 * so Google can display rich FAQ snippets in search results.
 * Overhaul v2 copy: Peak Music Reviews is a community platform, not a blog.
 */

import type { FAQItem } from "@/components/seo/FAQSchema";

export const aboutFAQs: FAQItem[] = [
  {
    question: "What is Peak Music Reviews?",
    answer:
      "Peak Music Reviews is a music social network — think Letterboxd, but for albums. Members rate and review releases, build shareable lists, join live chat rooms when new albums drop, and argue their side in community debates. Every review is tied to a real release from the Spotify catalog or Genius's deep library, unreleased tracks included.",
  },
  {
    question: "How are albums rated on Peak Music Reviews?",
    answer:
      "Members rate releases from 0 to 10.0 with decimal precision. Ratings reflect genuine personal enjoyment rather than purely technical analysis — liking something for a dumb reason is just as valid as a technical breakdown. Release pages show the community average across all reviews.",
  },
  {
    question: "Can I review unreleased or leaked music on Peak Music Reviews?",
    answer:
      "Yes. the site's catalog is powered by both Spotify (the canonical released catalog) and Genius (the deep library — unreleased tracks, loosies, and songs that never hit streaming). Unreleased releases are clearly tagged on their pages.",
  },
  {
    question: "Do I need an account to use Peak Music Reviews?",
    answer:
      "Browsing is open to everyone. Rating, reviewing, building lists, joining live release rooms, and voting in debates require a free account with a unique username and a confirmed email address.",
  },
];

/* /musicboard-alternative — the questions displaced Musicboard users
   are actually typing into Google. Keep answers factual and dated;
   this page's credibility is the whole play.

   A function, not a const: the iOS-app answer flips automatically
   the moment the App Store listing goes live (the page checks
   Apple's lookup API) — no hand-edit, no stale claims either way. */
export function getMusicboardFAQs(appStoreLive: boolean): FAQItem[] {
  return [
  {
    question: "Is Musicboard shutting down?",
    answer:
      "Nothing official has been announced, but the signals are not good: TechCrunch reported in February 2026 that Musicboard had suffered repeated multi-day outages with no communication from its founders, the Android app is no longer available on Google Play, and the iOS app has not shipped an update since May 2025. Users have organized community campaigns asking for data exports.",
  },
  {
    question: "What is the best Musicboard alternative?",
    answer:
      "Peak Music Reviews is the closest like-for-like replacement: 0–10.0 decimal album ratings, written reviews, lists, and social profiles — plus things Musicboard never had, like live release-night chat rooms, two-sided debates, a For You feed, and a catalog that includes unreleased tracks via Genius. It is free, actively updated, and works fully on the web as well as iOS. RateYourMusic and Album of the Year are solid web-only databases if you mainly want charts rather than a social app.",
  },
  {
    question: "Can I import my Musicboard ratings into Peak Music Reviews?",
    answer:
      "There is no automatic importer yet — Musicboard does not offer a public data export. Rebuilding your top albums on Peak takes a few minutes: the universal search covers the entire Spotify catalog plus Genius deep cuts, and rating an album is two taps. If enough switchers ask, a dedicated import tool is on the table — tell us at contact@peakmusicreviews.com.",
  },
  {
    question: "Is Peak Music Reviews free?",
    answer:
      "Yes — all core functionality is free: rating, reviews, lists, live release rooms, debates, posts, and profile themes. An optional patron subscription with extra perks is planned, but the core experience stays free.",
  },
  {
    question: "Does Peak Music Reviews have a mobile app?",
    answer: appStoreLive
      ? "Yes — an iOS app on the App Store, with the exact same content and account as the website, so you are never locked to one platform. An Android release is planned. Unlike app-only services, everything also works in any browser."
      : "An iOS app is in the works, and an Android release is planned after it. In the meantime everything works fully in any mobile or desktop browser — same content, same account, nothing gated to an app.",
  },
  ];
}

export const reviewsFAQs: FAQItem[] = [
  {
    question: "Who writes the reviews on Peak Music Reviews?",
    answer:
      "The community. Every Peak Music Reviews member can review any release in the catalog. Notable accounts carry verified badges, and each review page credits its author with a link to their profile.",
  },
  {
    question: "How does the Peak Music Reviews rating scale work?",
    answer:
      "The scale runs from 0 to 10.0 with decimal precision. Ratings above 9.0 are exceptional territory, 9.5+ gets an elite glow across the site, and a perfect 10 is reserved for all-timers. Release pages aggregate every member's rating into a community average.",
  },
  {
    question: "Can I review any song or album?",
    answer:
      "Yes — search the catalog while writing a review and pick any album from Spotify's catalog or any song from Genius's deep library, including unreleased material. Reviews are always attached to a real release, so there are no fake or duplicate entries.",
  },
  {
    question: "Can I filter and search reviews?",
    answer:
      "Yes. The reviews page has live search by title, artist, or reviewer, plus genre chips and minimum-rating filters that update instantly.",
  },
];
