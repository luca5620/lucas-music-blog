/**
 * FAQ Data — Structured FAQ content for schema markup.
 *
 * These FAQs are rendered as JSON-LD on their respective pages
 * so Google can display rich FAQ snippets in search results.
 */

import type { FAQItem } from "@/components/seo/FAQSchema";

export const aboutFAQs: FAQItem[] = [
  {
    question: "What is Peak Music Reviews?",
    answer:
      "Peak Music Reviews is a music blog by Luca that combines honest album reviews with real Spotify listening data. Every review is backed by actual streaming numbers — no reviewing an album after one listen and pretending to have absorbed the whole thing.",
  },
  {
    question: "How are albums rated on Peak Music Reviews?",
    answer:
      "Albums are rated on a scale of 1.0 to 10.0, with decimal precision. Ratings reflect personal enjoyment and listening habits rather than purely technical analysis. A 10/10 is reserved for truly life-changing albums, while anything above 8.0 is considered elite territory.",
  },
  {
    question: "What data does Peak Music Reviews use?",
    answer:
      "Peak Music Reviews uses extended Spotify streaming history data spanning multiple years, including over 8,000 hours of listening across 152,000+ total streams and 3,000+ artists. This data backs every review and powers the analytics dashboard on the site.",
  },
  {
    question: "Who writes the reviews on Peak Music Reviews?",
    answer:
      "All reviews are written by Luca, a lifelong music listener and data enthusiast. Luca tracks personal Spotify listening data and writes honest opinions without pretentious jargon or gatekeeping — just real takes on music.",
  },
  {
    question: "How does Peak Music Reviews pick which albums to review?",
    answer:
      "Albums are chosen based on personal listening habits and Spotify data. If an album gets significant play time and leaves an impression, it earns a review. The catalog spans R&B, Hip-Hop, Pop, and Alternative, with artists ranging from The Weeknd and Frank Ocean to Radiohead and TV Girl.",
  },
];

export const reviewsFAQs: FAQItem[] = [
  {
    question: "How often are new reviews posted on Peak Music Reviews?",
    answer:
      "New reviews are posted as albums earn enough listening time to warrant an honest take. There is no fixed schedule — quality and genuine engagement with the music come first. Some reviews are published shortly after release, while classic albums are reviewed after years of listening.",
  },
  {
    question: "What music genres does Peak Music Reviews cover?",
    answer:
      "Peak Music Reviews currently covers four main genres: R&B, Hip-Hop, Pop, and Alternative. The catalog includes artists like The Weeknd, Frank Ocean, Bruno Mars, Playboi Carti, Travis Scott, Radiohead, NewJeans, and TV Girl, among others.",
  },
  {
    question: "How does the Peak Music Reviews rating scale work?",
    answer:
      "The rating scale runs from 1.0 to 10.0 with decimal precision. Ratings above 9.0 are considered exceptional, 8.0 and above is elite territory, and a perfect 10.0 is reserved for albums considered all-time greats. Every rating is informed by actual Spotify listening data and personal connection to the music.",
  },
  {
    question: "Can I filter reviews by genre?",
    answer:
      "Yes. The reviews page includes genre filter buttons that let you browse reviews by R&B, Hip-Hop, Pop, or Alternative. You can toggle genres on and off to find exactly what you are looking for.",
  },
];
