/**
 * Robots.txt — Next.js App Router convention.
 *
 * Generates /robots.txt automatically. Allows all crawlers
 * on all pages and points to the sitemap URL.
 */

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: "https://peakmusicreviews.com/sitemap.xml",
  };
}
