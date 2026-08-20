/**
 * Root loading state — shown INSTANTLY on every navigation while the
 * next page's server render is in flight.
 *
 * This file is the fix for the single worst mobile feel-issue: pages
 * here are dynamic (auth cookies), so a tap on a link produced NOTHING
 * on screen until the server answered — people tapped again and again
 * thinking the tap didn't register. With a loading boundary, Next.js
 * swaps the content for this the moment the tap lands.
 *
 * Styled as the CRT changing channels: static bars + a TUNING readout.
 */
export default function Loading() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 py-32"
      role="status"
      aria-label="Loading"
    >
      {/* Channel-change static: three bars sweeping out of phase */}
      <div className="flex items-end gap-1.5 h-8" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-1.5 rounded-sm bg-accent-primary/70 animate-pulse"
            style={{
              height: `${[60, 100, 40, 80, 55][i]}%`,
              animationDelay: `${i * 120}ms`,
              animationDuration: "0.9s",
            }}
          />
        ))}
      </div>
      <p className="osd-text text-sm tracking-widest opacity-70">TUNING…</p>
    </div>
  );
}
