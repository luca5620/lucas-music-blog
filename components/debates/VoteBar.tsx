/**
 * VoteBar — the two-sided tug-of-war bar.
 *
 * Pure presentational (works in server AND client components).
 * Uses the .debate-bar / .side-a / .side-b primitives from
 * globals.css; widths animate via the CSS transition there.
 *
 * With zero votes we render a 50/50 split at low opacity so the
 * bar never looks broken — an empty debate is still a debate.
 */

interface VoteBarProps {
  a: number;
  b: number;
  sideALabel: string;
  sideBLabel: string;
  /** Compact mode drops the labels row (used on index cards). */
  compact?: boolean;
}

export default function VoteBar({
  a,
  b,
  sideALabel,
  sideBLabel,
  compact = false,
}: VoteBarProps) {
  const total = a + b;
  const pctA = total === 0 ? 50 : Math.round((a / total) * 100);
  const pctB = total === 0 ? 50 : 100 - pctA;

  return (
    <div className="space-y-1.5">
      {!compact && (
        <div className="flex items-baseline justify-between gap-3 text-xs font-bold uppercase tracking-wide font-[family-name:var(--font-heading)]">
          <span className="text-accent-primary truncate">
            {sideALabel} · {pctA}%
          </span>
          <span className="text-accent-rose truncate text-right">
            {pctB}% · {sideBLabel}
          </span>
        </div>
      )}

      <div
        className="debate-bar"
        style={{ opacity: total === 0 ? 0.45 : 1 }}
        role="img"
        aria-label={`${sideALabel}: ${pctA}%, ${sideBLabel}: ${pctB}%`}
      >
        <div className="side-a" style={{ width: `${pctA}%` }} />
        <div className="side-b" style={{ width: `${pctB}%` }} />
      </div>

      {compact && (
        <div className="flex items-baseline justify-between gap-3 text-[10px] uppercase tracking-wide text-text-muted">
          <span className="truncate">{sideALabel}</span>
          <span className="pixel-text tabular-nums shrink-0">
            {total} {total === 1 ? "vote" : "votes"}
          </span>
          <span className="truncate text-right">{sideBLabel}</span>
        </div>
      )}
    </div>
  );
}
