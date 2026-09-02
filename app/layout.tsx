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
import PressMode from "@/components/ui/PressMode";
import OfflineOverlay from "@/components/ui/OfflineOverlay";
import PullToRefresh from "@/components/ui/PullToRefresh";
import ImageReveal from "@/components/ui/ImageReveal";
import TabBar from "@/components/ui/TabBar";
import PushRegistration from "@/components/ui/PushRegistration";
import SiteFooter from "@/components/ui/SiteFooter";
import CRTShell from "@/components/ui/CRTShell";
import NavigationPending from "@/components/ui/NavigationPending";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Analytics } from "@vercel/analytics/next";
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
        {/* The room: liquid light filling the black space around the
            bezel — the side bars glow on wide screens. Painted first
            so the TV sits on top of it. */}
        <div className="liquid-room" aria-hidden="true">
          {/* Sizes grown ~25% + one extra blob per side (Luca
              2026-08-26, DESKTOP PROMINENCE in globals.css): the room
              is web-only (hidden ≤640px and in the app), so it can
              afford to glow bigger without touching mobile. */}
          <div className="liquid-blob liquid-a w-[640px] h-[640px] top-[6%] -left-56" />
          <div className="liquid-blob liquid-c w-[580px] h-[580px] top-[42%] -left-48" />
          <div className="liquid-blob liquid-b w-[600px] h-[600px] top-[76%] -left-52" />
          <div className="liquid-blob liquid-c w-[560px] h-[560px] top-[26%] -left-44" />
          <div className="liquid-blob liquid-b w-[620px] h-[620px] top-[14%] -right-56" />
          <div className="liquid-blob liquid-a w-[560px] h-[560px] top-[52%] -right-48" />
          <div className="liquid-blob liquid-c w-[600px] h-[600px] top-[84%] -right-52" />
          <div className="liquid-blob liquid-a w-[560px] h-[560px] top-[32%] -right-44" />
        </div>

        {/* CRT atmosphere: grain, scanlines, grille */}
        <GrainOverlay />
        {/* Tags <html> when running inside the native app shell */}
        <NativeMode />
        {/* Hidden ?press=1 screenshot mode — blurs catalog artwork
            for App Store listing assets (Guideline 5.2.1) */}
        <PressMode />

        <AuthProvider initialUser={user} initialProfile={profile}>
          {/* Everything renders on the tube */}
          <CRTShell>
            <Navigation />
            {/* Instant tap feedback, in the slot app/loading.tsx used
                to occupy — see the component header for why that file
                had to go (it made every notFound() a soft 404). */}
            <NavigationPending>{children}</NavigationPending>
            {/* Bug-report hatch on every page */}
            <SiteFooter />
          </CRTShell>
          {/* App-only bottom tabs — renders null on the web */}
          <TabBar />
          {/* App-only: registers this device for push when signed in
              (renders null; web + signed-out are no-ops) */}
          <PushRegistration />
          {/* App-only NO SIGNAL screen for mid-session connection loss */}
          <OfflineOverlay />
          {/* App-only pull-down-to-refresh gesture */}
          <PullToRefresh />
          {/* Site-wide cover-art blur-up on image load */}
          <ImageReveal />
        </AuthProvider>
        {/* Vercel Web Analytics (enabled in the dashboard 2026-08-25).
            The dashboard toggle alone records nothing on Next.js —
            this component is what actually sends the page views.
            Same-origin (/_vercel/insights), so CSP stays untouched;
            cookieless, no personal data. */}
        <Analytics />
      </body>
    </html>
  );
}
