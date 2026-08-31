/**
 * Web App Manifest — Next.js App Router convention.
 *
 * Generates /manifest.webmanifest automatically. This is what makes
 * the site installable to a phone home screen (PWA) and themes the
 * browser chrome. The native iOS/Android apps are separate (Capacitor
 * shell — see docs/MACBOOK-IOS-SETUP.md) but share this identity.
 */

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peak Music Reviews",
    // Home-screen label — the full name truncates under the icon
    // (Luca 2026-08-31), same change as the native apps.
    short_name: "Peak Music",
    description:
      "Rate albums, build lists, join live release rooms and debates. Every record on Spotify plus the deep Genius catalog — unreleased included.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["music", "social", "entertainment"],
    icons: [
      {
        src: "/favicon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Write a review",
        url: "/reviews/new",
        description: "Rate something you just heard",
      },
      {
        name: "Debates",
        url: "/debates",
        description: "Jump into the arena",
      },
    ],
  };
}
