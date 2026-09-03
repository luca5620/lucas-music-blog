import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getDebateBySlug,
  getDebateMessageReactionCounts,
  getDebateMessages,
  getUserVote,
  getViewerDebateReactions,
} from "@/lib/db/debates";
import { getUser } from "@/lib/auth";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import DebateRoom from "@/components/debates/DebateRoom";
import PublishDebateButton from "@/components/debates/PublishDebateButton";
import DeleteDebateButton from "@/components/debates/DeleteDebateButton";
import BackLink from "@/components/ui/BackLink";

// Live rooms: votes, messages, and reactions change second to second.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const debate = await getDebateBySlug(slug);
  if (!debate) notFound(); // real 404, not a soft one — see app/not-found.tsx
  return {
    title: debate.title,
    description:
      debate.prompt ??
      `${debate.side_a_label} vs ${debate.side_b_label} — vote and argue live.`,
  };
}

/**
 * /debates/[slug] — one debate room.
 * Server component fetches the debate + backlog + the viewer's vote,
 * then hands off to the DebateRoom client for the live parts.
 */
export default async function DebatePage({ params }: PageProps) {
  const { slug } = await params;
  const debate = await getDebateBySlug(slug);
  if (!debate) notFound();

  const user = await getUser();
  const [messages, userVote] = await Promise.all([
    getDebateMessages(debate.id),
    user ? getUserVote(debate.id, user.id) : Promise.resolve(null),
  ]);

  // Reaction state needs the message ids, so it runs as a second wave.
  const [reactionCounts, viewerReactions] = await Promise.all([
    getDebateMessageReactionCounts(messages.map((m) => m.id)),
    user
      ? getViewerDebateReactions(user.id, debate.id)
      : Promise.resolve([]),
  ]);

  const creatorName =
    debate.creator?.display_name || debate.creator?.username || "unknown";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ══════════ Draft banner (migration 024) ══════════
          RLS means only the creator can load an unpublished debate at
          all, so no viewer check is needed — anyone seeing this IS the
          author. Publish flips is_published and the room goes live. */}
      {debate.is_published === false && (
        <section className="panel-xbox p-4 border-yellow-500/30 bg-yellow-500/5 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-[family-name:var(--font-vt323)]">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            Draft — only you can see this
          </span>
          <PublishDebateButton debateId={debate.id} />
        </section>
      )}

      {/* ══════════ Debate header ══════════ */}
      <section className="space-y-3">
        {/* Plain Back (Luca 2026-08-31: replaced the ARENA / ON AIR
            crumb) — same BackLink convention as release/list pages. */}
        <div className="flex items-center justify-between gap-3">
          <BackLink
            fallback="/debates"
            label="Back"
            className="pixel-text text-xs text-accent-primary hover:text-accent-glow transition-colors uppercase tracking-widest inline-flex items-center gap-1"
          />
          {/* Creator's controls (Luca 2026-09-02): edit here, or from
              the manage hub at /reviews/mine. */}
          {user?.id === debate.created_by && (
            <span className="flex items-center gap-2">
              <Link
                href={`/debates/${debate.slug}/edit`}
                className="btn-y2k btn-y2k-outline text-xs"
              >
                Edit
              </Link>
              <DeleteDebateButton debateId={debate.id} debateTitle={debate.title} />
            </span>
          )}
        </div>

        <div className="flex items-start gap-4">
          {/* Pinned release, physical-media style */}
          {debate.release && (
            <Link
              href={`/releases/${debate.release.slug}`}
              className="poster w-20 h-20 sm:w-24 sm:h-24 shrink-0"
              title={debate.release.title}
            >
              {debate.release.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={debate.release.cover_image}
                  alt={debate.release.title}
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-3xl">
                  💿
                </span>
              )}
            </Link>
          )}

          <div className="min-w-0 space-y-2">
            <h1 className="crt-title text-2xl sm:text-4xl leading-tight">
              {debate.title}
            </h1>
            {debate.prompt && (
              <p className="text-sm text-text-secondary leading-relaxed">
                {debate.prompt}
              </p>
            )}

            {/* Per-side records (migration 039): each side's poster
                links to its release, tinted in that side's colour. */}
            {(debate.side_a_release || debate.side_b_release) && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {(
                  [
                    { tone: "a", label: debate.side_a_label, release: debate.side_a_release },
                    { tone: "b", label: debate.side_b_label, release: debate.side_b_release },
                  ] as const
                ).map(({ tone, label, release }) =>
                  release ? (
                    <Link
                      key={tone}
                      href={`/releases/${release.slug}`}
                      className="flex items-center gap-2 group/side"
                      title={release.title}
                    >
                      <span
                        className={`w-12 h-12 rounded overflow-hidden border shrink-0 ${
                          tone === "a" ? "border-accent-primary/60" : "border-accent-rose/60"
                        }`}
                      >
                        {release.cover_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={release.cover_image} alt={release.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center">💿</span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-[10px] uppercase tracking-widest font-[family-name:var(--font-heading)] ${
                            tone === "a" ? "text-accent-primary" : "text-accent-rose"
                          }`}
                        >
                          {label}
                        </span>
                        <span className="block text-sm font-bold text-text-primary truncate max-w-[12rem] group-hover/side:text-accent-glow transition-colors">
                          {release.title}
                        </span>
                      </span>
                    </Link>
                  ) : null
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span>opened by</span>
              {debate.creator ? (
                <Link
                  href={`/profile/${debate.creator.username}`}
                  className="font-bold text-text-secondary hover:text-accent-primary transition-colors"
                >
                  {creatorName}
                </Link>
              ) : (
                <span className="font-bold text-text-secondary">
                  {creatorName}
                </span>
              )}
              {debate.creator && <VerifiedBadge role={debate.creator.role} />}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ Vote + live floor (client) ══════════ */}
      <DebateRoom
        debate={debate}
        initialMessages={messages}
        initialUserVote={userVote}
        initialReactionCounts={reactionCounts}
        initialViewerReactions={viewerReactions}
      />
    </div>
  );
}
