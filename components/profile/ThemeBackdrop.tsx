/**
 * ThemeBackdrop — animated dashboard atmosphere per console preset.
 *
 * The signature motion of each console's home screen, rebuilt as
 * pure CSS (no images, no video, transform/opacity animations only
 * so it stays cheap on phones):
 *  - ps3:      the XMB flowing ribbon + drifting sparkles
 *  - ps4:      slow diagonal light rays + floating particles
 *  - xbox-og:  the pulsing green energy orb
 *  - xbox-360: sweeping blade-green waves
 *  - wii:      soft bubbles drifting up the channel screen
 *  - crt-blue / limewire: intentionally static (no backdrop)
 *
 * Sits at -z behind the profile content (the wrapper isolates its
 * stacking context); pointer-transparent; all animations respect
 * prefers-reduced-motion via the shared media query in globals.css.
 */

import type { ProfileTheme } from "@/lib/types/database";
import BackdropVideo from "@/components/profile/BackdropVideo";

/** Deterministic sparkle/bubble positions — no Math.random so the
    server render always matches the client. */
const SPARKS = [
  { left: "12%", top: "22%", delay: "0s", dur: "7s" },
  { left: "28%", top: "64%", delay: "1.8s", dur: "9s" },
  { left: "47%", top: "35%", delay: "3.1s", dur: "6.5s" },
  { left: "63%", top: "70%", delay: "0.9s", dur: "8s" },
  { left: "78%", top: "28%", delay: "2.4s", dur: "7.5s" },
  { left: "90%", top: "55%", delay: "4s", dur: "9.5s" },
];

const BUBBLES = [
  { left: "8%", size: 46, delay: "0s", dur: "18s" },
  { left: "24%", size: 30, delay: "4s", dur: "22s" },
  { left: "43%", size: 56, delay: "9s", dur: "20s" },
  { left: "61%", size: 26, delay: "2s", dur: "16s" },
  { left: "77%", size: 40, delay: "6s", dur: "24s" },
  { left: "91%", size: 32, delay: "11s", dur: "19s" },
];

export default function ThemeBackdrop({ theme }: { theme: ProfileTheme }) {
  return (
    <div
      className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Themed liquid wash — the blob colors come from the theme's
          --liquid-* vars (set by the theme-* class wrapping the
          profile), so a PS3 profile drifts silver-blue, Xbox OG acid
          green, Robot Rock gold, and so on. */}
      <div className="liquid-blob liquid-a w-[460px] h-[460px] -top-32 -left-24" />
      <div className="liquid-blob liquid-b w-[400px] h-[400px] top-[30%] -right-28" />
      <div className="liquid-blob liquid-c w-[420px] h-[420px] top-[65%] -left-28" />

      {/* Prerendered 3D loop when public/backdrops/<theme>.webm exists;
          hides itself when the file is absent and the CSS scene below
          carries the theme instead. */}
      <BackdropVideo theme={theme} />
      {theme === "ps2" && (
        <>
          <div className="bd-ps2-nebula" />
          <div className="bd-ps2-nebula bd-ps2-nebula2" />
          <div className="bd-ps2-haze" />
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="bd-spark bd-spark-silver"
              style={{
                left: s.left,
                top: s.top,
                animationDelay: s.delay,
                animationDuration: s.dur,
              }}
            />
          ))}
        </>
      )}

      {theme === "ps3" && (
        <>
          <div className="bd-ps3-ribbon" />
          <div className="bd-ps3-ribbon bd-ps3-ribbon2" />
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="bd-spark"
              style={{
                left: s.left,
                top: s.top,
                animationDelay: s.delay,
                animationDuration: s.dur,
              }}
            />
          ))}
        </>
      )}

      {theme === "ps4" && (
        <>
          <div className="bd-ps4-ray" />
          <div className="bd-ps4-ray bd-ps4-ray2" />
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="bd-spark bd-spark-blue"
              style={{
                left: s.left,
                top: s.top,
                animationDelay: s.delay,
                animationDuration: s.dur,
              }}
            />
          ))}
        </>
      )}

      {theme === "xbox-og" && (
        <>
          <div className="bd-og-orb" />
          <div className="bd-og-ring" />
          <div className="bd-og-ring bd-og-ring2" />
          <div className="bd-og-ring bd-og-ring3" />
        </>
      )}

      {theme === "xbox-360" && (
        <>
          <div className="bd-360-wave" />
          <div className="bd-360-wave bd-360-wave2" />
        </>
      )}

      {theme === "bleach" && (
        <>
          <div className="bd-bleach-tone" />
          <div className="bd-bleach-slash" />
          <div className="bd-bleach-slash bd-bleach-slash2" />
          <div className="bd-bleach-slash bd-bleach-slash-red" />
        </>
      )}

      {theme === "daft-punk" && (
        <>
          <div className="bd-dp-pyramid" />
          <div className="bd-dp-grid" />
        </>
      )}

      {theme === "wii" && (
        <>
          {BUBBLES.map((b, i) => (
            <span
              key={i}
              className="bd-bubble"
              style={{
                left: b.left,
                width: b.size,
                height: b.size,
                animationDelay: b.delay,
                animationDuration: b.dur,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
