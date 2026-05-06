/**
 * Dynamic Sitemap — Next.js App Router convention.
 *
 * Generates /sitemap.xml automatically at build time.
 * Includes all static pages plus every individual review page
 * pulled from the review data source.
 */

import type { MetadataRoute } from "next";
import { reviews } from "@/lib/reviews";

const BASE_URL = "https://peakmusicreviews.com";

export default function sitemap(): MetadataRoute.Sitemap {
  // Static pages with manually tuned priority and changeFrequency
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/reviews`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/profile/lucas`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // Dynamic review pages — one entry per review slug
  const reviewPages: MetadataRoute.Sitemap = reviews.map((review) => ({
    url: `${BASE_URL}/reviews/${review.slug}`,
    lastModified: review.reviewDate
      ? new Date(review.reviewDate)
      : new Date(review.releaseDate),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...reviewPages];
}
