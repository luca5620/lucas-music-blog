/**
 * ComingSoonPanel — Reusable placeholder shell for pages that aren't built yet.
 * Server component. Intentionally a dead end: no CTAs, no links, just vibes.
 */

interface ComingSoonPanelProps {
  title: string;
  tagline: string;
  description: string;
  accent?: "primary" | "rose";
  eta?: string;
}

export default function ComingSoonPanel({
  title,
  tagline,
  description,
  accent = "primary",
  eta,
}: ComingSoonPanelProps) {
  const accentClass =
    accent === "rose" ? "text-accent-rose" : "text-accent-primary";

  return (
    <section className="panel-xbox-glow p-6 sm:p-10 md:p-12 max-w-2xl mx-auto space-y-6 relative overflow-hidden">
      {/* Decorative glow orbs */}
      <span className="glow-orb absolute top-4 left-4" />
      <span
        className="glow-orb absolute top-4 right-4"
        style={{ animationDelay: "1.5s" }}
      />

      {/* Status pill */}
      <div>
        <span className="label-xbox">STATUS: OFFLINE</span>
      </div>

      {/* Title */}
      <h1
        className={`font-[family-name:var(--font-heading)] text-4xl sm:text-6xl font-extrabold ${accentClass}`}
      >
        {title}
      </h1>

      {/* Tagline */}
      <p className="pixel-text text-sm italic text-text-muted">{tagline}</p>

      <div className="divider-glow" />

      {/* Description */}
      <p className="text-text-secondary leading-relaxed">{description}</p>

      {/* ETA caption */}
      {eta && (
        <p className="pixel-text text-xs uppercase tracking-widest text-text-muted">
          ETA: {eta}
        </p>
      )}

      {/* Animated scan bar at bottom */}
      <div className="scan-bar" />
    </section>
  );
}
