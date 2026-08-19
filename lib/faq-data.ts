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
