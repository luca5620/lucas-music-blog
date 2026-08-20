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
      {/* The disc spins behind the right side of the band. Phones hide
          it (the box is too small — everything would overlap), and a
          dark scrim sits over it so gray text crossing the chrome
          stays readable. */}
      <div
        className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <ChromeDisc className="hidden sm:block absolute -right-16 md:-right-10 -top-14 w-56 md:w-72 opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/35 to-black/10" />
      </div>
      <div className="space-y-3 text-center sm:text-left">
        <h1 className="crt-title text-3xl sm:text-4xl">{title}</h1>
        {sub && (
          <p className="text-text-secondary text-sm max-w-xl mx-auto sm:mx-0">
            {sub}
          </p>
        )}
        {children}
      </div>
      <div className="scan-bar" />
    </section>
  );
}
