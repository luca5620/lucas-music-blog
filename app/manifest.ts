/**
 * Web App Manifest — Next.js App Router convention.
 *
 * Generates /manifest.webmanifest automatically.
 * Provides metadata for PWA install prompts, mobile home screen icons,
 * and browser theming.
 */

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peak Music Reviews",
    short_name: "Peak Music",
    description:
      "Honest music reviews and Spotify listening analytics by Luca. No pretentious jargon — just real opinions backed by data.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#1e90ff",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/favicon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
