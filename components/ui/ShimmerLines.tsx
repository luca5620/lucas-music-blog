/**
 * ShimmerLines — placeholder for text that streams in via Suspense
 * (release/song bios, anything description-shaped). A dim label row
 * plus a few sweeping shimmer bars where the words will land, so the
 * slot never sits blank and then pops (UI-cleanup pass, Luca
 * 2026-08-27). Server-safe: no hooks, just CSS animation.
 *
 * Kept deliberately quiet: some slots resolve to NOTHING (a release
 * with no bio) and a loud skeleton that vanishes reads as a glitch.
 */
export default function ShimmerLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="divider-glow" />
      <div className="flex items-center gap-2">
        <span className="glow-orb opacity-40" />
        <span className="shimmer-line w-24 h-3" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <span
            key={i}
            className={`shimmer-line block ${i === lines - 1 ? "w-2/3" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}
