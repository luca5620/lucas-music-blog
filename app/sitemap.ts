/**
 * Dynamic Sitemap — Next.js App Router convention.
 *
 * Static platform pages plus the published review and release URLs
 * pulled live from the database. If the DB is unreachable at build
 * time the sitemap degrades to static routes only — never fails.
 */

import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = "https://peakmusicreviews.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/reviews`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/releases`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/lists`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/debates`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/artists`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    // Switcher landing page — targets "musicboard alternative" queries.
    { url: `${BASE_URL}/musicboard-alternative`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  ];

  try {
    const supabase = await createClient();

    const [{ data: reviews }, { data: releases }] = await Promise.all([
      supabase
        .from("reviews")
        .select("slug, updated_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("releases")
        .select("slug, updated_at")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    const reviewPages: MetadataRoute.Sitemap = (
      (reviews ?? []) as { slug: string; updated_at: string }[]
    ).map((r) => ({
      url: `${BASE_URL}/reviews/${r.slug}`,
      lastModified: new Date(r.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const releasePages: MetadataRoute.Sitemap = (
      (releases ?? []) as { slug: string; updated_at: string }[]
    ).map((r) => ({
      url: `${BASE_URL}/releases/${r.slug}`,
      lastModified: new Date(r.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    return [...staticPages, ...reviewPages, ...releasePages];
  } catch {
    return staticPages;
  }
}
