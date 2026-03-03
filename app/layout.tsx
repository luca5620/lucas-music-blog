import type { Metadata } from "next";
import { Inter, Space_Grotesk, VT323 } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/ui/Navigation";
import GrainOverlay from "@/components/ui/GrainOverlay";
import PS1CaseFrame from "@/components/ui/PS2CaseFrame";
import TVTransition from "@/components/ui/TVTransition";
import { WebSiteSchema, PersonSchema } from "@/app/schema";

/* --- Font Setup ---
   - Inter: clean body text
   - Space Grotesk: geometric retro-modern headings
   - VT323: pixel/monospace for accents and labels */

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
    default: "Peak Music Reviews",
    template: "%s — Peak Music Reviews",
  },
  description:
    "Honest music reviews and Spotify listening analytics. No pretentious jargon — just real opinions backed by real Spotify data.",
  alternates: {
    canonical: "https://peakmusicreviews.com",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Peak Music Reviews",
    url: "https://peakmusicreviews.com",
    title: "Peak Music Reviews",
    description:
      "Honest music reviews and Spotify listening analytics. No pretentious jargon — just real opinions.",
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
    title: "Peak Music Reviews",
    description:
      "Honest music reviews and Spotify listening analytics. No pretentious jargon — just real opinions.",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <WebSiteSchema />
        <PersonSchema />
      </head>
      <body
        className={`
          ${inter.variable} ${spaceGrotesk.variable} ${vt323.variable}
          antialiased
        `}
      >
        {/* Film grain + scan line overlays */}
        <GrainOverlay />

        {/* Everything sits inside the PS1 game case frame */}
        <PS1CaseFrame>
          {/* TV transition is INSIDE the case so it's clipped to the cover area */}
          <TVTransition />
          <Navigation />
          {children}
        </PS1CaseFrame>
      </body>
    </html>
  );
}
