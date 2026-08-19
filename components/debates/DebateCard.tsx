import Link from "next/link";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import VoteBar from "@/components/debates/VoteBar";
import type { DebateWithMeta } from "@/lib/db/debates";

/**
 * DebateCard — one debate on the index grid.
 * Title, live vote split, message count, creator, and (when the
 * debate is pinned to a release) the cover as physical-media flair.
 */
export default function DebateCard({ debate }: { debate: DebateWithMeta }) {
  const creatorName =
    debate.creator?.display_name || debate.creator?.username || "unknown";

  return (
    <Link
      href={`/debates/${debate.slug}`}
      className="panel-xbox p-4 sm:p-5 block space-y-3 hover-glow relative overflow-hidden group"
    >
      {/* Status row: LIVE/CLOSED + message counter, OSD style */}
      <div className="flex items-center justify-between gap-2">
        <span className="osd-text text-xs">
          {debate.status === "open" ? (
            <>
              {/* .osd-rec only styles inside .crt-osd — inline the red dot */}
              <span className="text-[#ff4455] animate-pulse">●</span> ON AIR
            </>
          ) : (
            <span className="opacity-60">SIGN-OFF</span>
          )}
        </span>
        <span className="osd-text text-xs opacity-80">
          {debate.message_count} TAKES
        </span>
      </div>

      {/* Topic + optional release cover */}
      <div className="flex items-start gap-3">
        {debate.release?.cover_image && (
          <span className="w-14 h-14 rounded overflow-hidden border border-border-subtle shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={debate.release.cover_image}
              alt={debate.release.title}
              className="w-full h-full object-cover"
            />
          </span>
        )}
        <h3 className="crt-title text-lg leading-snug group-hover:text-accent-glow transition-colors">
          {debate.title}
        </h3>
      </div>

      <VoteBar
        a={debate.votes.a}
        b={debate.votes.b}
        sideALabel={debate.side_a_label}
        sideBLabel={debate.side_b_label}
        compact
      />

      {/* Creator byline */}
      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        <span>opened by</span>
        <span className="font-bold text-text-secondary">{creatorName}</span>
        {debate.creator && <VerifiedBadge role={debate.creator.role} />}
      </div>

      <div className="scan-bar" />
    </Link>
  );
}
