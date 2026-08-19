import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, VT323 } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/ui/Navigation";
import GrainOverlay from "@/components/ui/GrainOverlay";
import CRTShell from "@/components/ui/CRTShell";
import TVTransition from "@/components/ui/TVTransition";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { WebSiteSchema } from "@/app/schema";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

/* --- Font Setup ---
   - Inter: clean body text
   - Space Grotesk: geometric retro-modern headings
   - VT323: pixel/monospace for OSD text and labels */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://peakmusicreviews.com"),
  title: {
    default: "PEAK — the music social network",
    template: "%s — PEAK",
  },
  description:
    "Rate albums, log your taste, join live release rooms and debates. A music social platform with a CRT soul — every record on Spotify and the deep Genius catalog, unreleased included.",
  alternates: {
    canonical: "https://peakmusicreviews.com",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "PEAK",
    url: "https://peakmusicreviews.com",
    title: "PEAK — the music social network",
    description:
      "Rate albums, build lists, join live release rooms and debates. Letterboxd energy for music, on a CRT.",
    images: [
      {
        url: "/penguin-logo.png",
        width: 512,
        height: 512,
        alt: "PEAK",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PEAK — the music social network",
    description:
      "Rate albums, build lists, join live release rooms and debates.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PEAK",
  },
};

export const viewport: Viewport = {
  themeColor: "#060607",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch the current user + profile on the server so the nav avatar
  // renders on first paint with no loading flash and no client-side race.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data as Profile | null;
  }

  return (
    <html lang="en">
      <head>
        <WebSiteSchema />
      </head>
      <body
        className={`
          ${inter.variable} ${spaceGrotesk.variable} ${vt323.variable}
          antialiased
        `}
      >
        {/* CRT atmosphere: grain, scanlines, grille, vsync band */}
        <GrainOverlay />

        <AuthProvider initialUser={user} initialProfile={profile}>
          {/* Everything renders on the tube */}
          <CRTShell>
            {/* Channel-change transition is INSIDE the screen so it clips */}
            <TVTransition />
            <Navigation />
            {children}
          </CRTShell>
        </AuthProvider>
      </body>
    </html>
  );
}
