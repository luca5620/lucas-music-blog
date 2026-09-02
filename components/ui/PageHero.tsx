import LiquidAtmosphere from "@/components/ui/LiquidAtmosphere";
import ChromeDisc from "@/components/ui/ChromeDisc";

/**
 * PageHero — the boxed page header, identical treatment to the HOME
 * band (Luca 2026-08-20: "make it all like the home page with the
 * box"): a glowing panel with the liquid iridescent atmosphere
 * drifting inside it and the chrome disc spinning behind the right
 * edge. Title + optional subtitle + optional extra content (CTA
 * buttons etc.) via children.
 */
export default function PageHero({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="panel-xbox-glow p-6 sm:p-8 relative isolate overflow-hidden">
      <LiquidAtmosphere />
      {/* The disc spins behind the right side of the band — compact
          on phones, bigger as the box grows. The scrim knocks the
          chrome back; the subtitle's own .hero-copy halo does the
          rest, since the scrim alone still left gray text washed out
          against the bright ring (Luca 2026-09-02). */}
      <div
        className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        {/* Phones: centered behind the centered title. sm+: behind
            the right edge, matching the left-aligned text. */}
        <ChromeDisc className="absolute w-36 left-1/2 -translate-x-1/2 -top-10 sm:left-auto sm:translate-x-0 sm:w-56 sm:-right-16 sm:-top-14 md:w-72 md:-right-10 opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/35 to-black/10" />
      </div>
      <div className="space-y-3 text-center sm:text-left">
        <h1 className="crt-title text-3xl sm:text-4xl">{title}</h1>
        {sub && (
          <p className="hero-copy text-sm max-w-xl mx-auto sm:mx-0">
            {sub}
          </p>
        )}
        {children}
      </div>
      <div className="scan-bar" />
    </section>
  );
}
