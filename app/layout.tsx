import type { Metadata, Viewport } from "next";
import {
  Inter,
  Chakra_Petch,
  Jost,
  Michroma,
  Quicksand,
  VT323,
} from "next/font/google";
import "./globals.css";
import Navigation from "@/components/ui/Navigation";
import GrainOverlay from "@/components/ui/GrainOverlay";
import NativeMode from "@/components/ui/NativeMode";
import TabBar from "@/components/ui/TabBar";
import CRTShell from "@/components/ui/CRTShell";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { WebSiteSchema } from "@/app/schema";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

/* --- Font Setup ---
   - Inter: clean body text
   - Chakra Petch: squared console-dashboard headings (site-wide)
   - VT323: pixel/monospace for small labels
   - Jost / Michroma / Quicksand: profile theme presets only
     (PS3+PS4 / OG Xbox / Wii — LimeWire uses system Verdana) */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

const michroma = Michroma({
  variable: "--font-michroma",
  weight: "400",
  subsets: ["latin"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
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
    default: "Peak Music Reviews — the music social network",
    template: "%s — Peak Music Reviews",
  },
  description:
    "Rate albums, log your taste, join live release rooms and debates. A music social platform — every record on Spotify and the deep Genius catalog, unreleased included.",
  alternates: {
    canonical: "https://peakmusicreviews.com",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Peak Music Reviews",
    url: "https://peakmusicreviews.com",
    title: "Peak Music Reviews — the music social network",
    description:
      "Rate albums, build lists, join live release rooms and debates. Letterboxd energy for music.",
    images: [
      {
        url: "/penguin-logo.png",
        width: 512,
        height: 512,
        alt: "Peak Music Reviews",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Peak Music Reviews — the music social network",
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
    title: "Peak Music Reviews",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
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
          ${inter.variable} ${chakraPetch.variable} ${jost.variable}
          ${michroma.variable} ${quicksand.variable} ${vt323.variable}
          antialiased
        `}
      >
        {/* CRT atmosphere: grain, scanlines, grille */}
        <GrainOverlay />
        {/* Tags <html> when running inside the native app shell */}
        <NativeMode />

        <AuthProvider initialUser={user} initialProfile={profile}>
          {/* Everything renders on the tube */}
          <CRTShell>
            <Navigation />
            {children}
          </CRTShell>
          {/* App-only bottom tabs — renders null on the web */}
          <TabBar />
        </AuthProvider>
      </body>
    </html>
  );
}
