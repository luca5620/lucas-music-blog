import Link from "next/link";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import VoteBar from "@/components/debates/VoteBar";
import type { DebateRelease, DebateWithMeta } from "@/lib/db/debates";

/**
 * DebateCard — one debate on the index grid.
 * Title, live vote split, message count, creator, and (when the
 * debate is pinned to a release) the cover as physical-media flair.
 */
export default function DebateCard({ debate }: { debate: DebateWithMeta }) {
  const t = useTranslations("debates.card");
  const creatorName =
    debate.creator?.display_name || debate.creator?.username || t("unknown");

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
              <span className="text-[#ff4455] animate-pulse">●</span> {t("onAir")}
            </>
          ) : (
            <span className="opacity-60">{t("signOff")}</span>
          )}
        </span>
        <span className="osd-text text-xs opacity-80">
          {t("takes", { n: debate.message_count })}
        </span>
      </div>

      {/* Topic + cover art. Two side records (migration 039) draw as
          a VS pair; otherwise the whole-debate pin, if any. */}
      <div className="flex items-start gap-3">
        {debate.side_a_release?.cover_image || debate.side_b_release?.cover_image ? (
          <span className="flex items-center gap-1 shrink-0">
            <SideCover release={debate.side_a_release} tone="a" />
            <span className="osd-text text-[10px] opacity-70">VS</span>
            <SideCover release={debate.side_b_release} tone="b" />
          </span>
        ) : debate.release?.cover_image ? (
          <span className="w-14 h-14 rounded overflow-hidden border border-border-subtle shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={debate.release.cover_image}
              alt={debate.release.title}
              className="w-full h-full object-cover"
            />
          </span>
        ) : null}
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
        <span>{t("openedBy")}</span>
        <span className="font-bold text-text-secondary">{creatorName}</span>
        {debate.creator && <VerifiedBadge role={debate.creator.role} />}
      </div>

      <div className="scan-bar" />
    </Link>
  );
}

/* A side's cover, ringed in that side's colour (A = accent, B = rose). */
function SideCover({
  release,
  tone,
}: {
  release: DebateRelease | null;
  tone: "a" | "b";
}) {
  const ring = tone === "a" ? "border-accent-primary/60" : "border-accent-rose/60";
  return (
    <span
      className={`w-12 h-12 rounded overflow-hidden border ${ring} shrink-0 bg-bg-elevated flex items-center justify-center`}
    >
      {release?.cover_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={release.cover_image} alt={release.title} className="w-full h-full object-cover" />
      ) : (
        <span className="text-lg">💿</span>
      )}
    </span>
  );
}
