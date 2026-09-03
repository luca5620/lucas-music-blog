/**
 * Robots.txt — Next.js App Router convention.
 *
 * Generates /robots.txt automatically. Allows all crawlers on all
 * pages and points to the sitemap URL.
 *
 * AI SEARCH (Luca 2026-09-02: "how to rank highly if someone asks
 * ChatGPT or Claude about music reviewing apps"). Those assistants
 * answer from two places: what their models learned in training, and
 * what their live web-search crawlers can fetch when someone asks.
 * Both go through named bots that honor robots.txt, and a growing
 * number of sites BLOCK them by default (Cloudflare's one-click AI
 * block, CDN presets), so an explicit allow list is a real signal
 * that we WANT to be read and cited. Each bot is listed by name so
 * a future "block AI training" toggle can be selective — the search
 * bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot) are the ones
 * that put us in ANSWERS; the training bots (GPTBot, ClaudeBot,
 * CCBot, Google-Extended) are what makes the model "know" us at all.
 *
 * Nothing private is exposed by this: RLS is the security boundary,
 * and the private surfaces (/search, /connections, /your-taste,
 * /admin) already carry noindex metadata.
 */

import type { MetadataRoute } from "next";

/** Crawlers behind AI assistants — training AND live-answer bots. */
const AI_CRAWLERS = [
  // OpenAI: GPTBot = training, OAI-SearchBot = ChatGPT search results,
  // ChatGPT-User = a user asked ChatGPT to open a page.
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  // Anthropic: ClaudeBot = training, Claude-SearchBot = search index,
  // Claude-User = a user asked Claude to open a page. "anthropic-ai"
  // is the legacy token some robots parsers still match on.
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "anthropic-ai",
  // Perplexity, Google's Gemini/AI-Overviews training flag, Apple
  // Intelligence, Common Crawl (feeds most open-model training sets),
  // Meta, Amazon, Bing's Copilot (uses bingbot, already covered by *).
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
  "Amazonbot",
  "DuckAssistBot",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
      // Explicit welcome mat for the AI crawlers (see header comment).
      // Same allow as everyone — listed so the intent is unambiguous
      // and so a bot that looks for its OWN name finds a rule.
      {
        userAgent: AI_CRAWLERS,
        allow: "/",
      },
    ],
    sitemap: "https://peakmusicreviews.com/sitemap.xml",
    host: "https://peakmusicreviews.com",
  };
}
