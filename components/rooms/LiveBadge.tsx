/**
 * LiveBadge — Phase 2b-4
 *
 * Stateless presentation: red pulsing dot + LIVE text when the supplied
 * `lastActivityAt` is within the threshold window. Server-renderable —
 * no client-side time ticking needed. Returns null below the threshold so
 * callers can mount it unconditionally and let it self-hide.
 */

interface LiveBadgeProps {
  lastActivityAt: string | null;
  /** Threshold in minutes for "LIVE" classification. Default 30. */
  thresholdMinutes?: number;
}

export default function LiveBadge({
  lastActivityAt,
  thresholdMinutes = 30,
}: LiveBadgeProps) {
  if (!lastActivityAt) return null;

  const last = Date.parse(lastActivityAt);
  if (Number.isNaN(last)) return null;

  // Unlike the dashboard's server-only clock read, this component is
  // also pulled into CLIENT trees (ReleaseViews, ChatPanel,
  // ReleaseRoomChat), so server and client compute `ageMs` a moment
  // apart. In the rare case where the room crosses the 30-minute line
  // in that gap, the two renders disagree and React re-renders the
  // subtree. Left as is on purpose: the alternatives are to render the
  // badge only after mount (it would pop in and shift the row — this
  // sits inline in release-card headers, and CLS on those was an SEO
  // fix we already paid for) or to thread a `now` prop through every
  // call site. Revisit if a hydration warning ever actually shows up.
  // eslint-disable-next-line react-hooks/purity
  const ageMs = Date.now() - last;
  if (ageMs > thresholdMinutes * 60 * 1000) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
      style={{
        background: "rgba(255, 51, 68, 0.12)",
        border: "1px solid rgba(255, 51, 68, 0.5)",
      }}
      aria-label="Room is live now"
    >
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: "#ff3344",
          animation: "live-pulse 1.6s ease-in-out infinite",
        }}
      />
      <span
        className="pixel-text text-[0.6rem] font-bold uppercase tracking-widest"
        style={{ color: "#ff3344" }}
      >
        Live
      </span>
    </span>
  );
}
