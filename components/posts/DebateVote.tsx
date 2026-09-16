"use client";

/**
 * DebateVote — the voting half of a debate post (migration 048).
 *
 * Two side buttons over the recovered VoteBar. One vote per person,
 * switchable, and tapping the side you already picked takes it back —
 * the same "latest choice wins, and you can undo it" behaviour the
 * Aux Wars vote has.
 *
 * Optimistic: the bar moves the instant you tap, and rolls back if
 * the request fails. The server tallies live on the post row (a
 * trigger keeps them), so a refresh always shows the truth.
 *
 * Signed out, the buttons become a prompt to sign in — visitors can
 * still READ the split, which is the point of putting debates where
 * the audience already is.
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import VoteBar from "@/components/posts/VoteBar";

export interface DebateSideRelease {
  slug: string;
  title: string;
  cover_image: string | null;
}

interface Props {
  postId: string;
  sideALabel: string;
  sideBLabel: string;
  sideARelease: DebateSideRelease | null;
  sideBRelease: DebateSideRelease | null;
  initialA: number;
  initialB: number;
  initialVote: "a" | "b" | null;
  signedIn: boolean;
  /** Where to send a signed-out reader back to after logging in. */
  next: string;
}

export default function DebateVote({
  postId,
  sideALabel,
  sideBLabel,
  sideARelease,
  sideBRelease,
  initialA,
  initialB,
  initialVote,
  signedIn,
  next,
}: Props) {
  const t = useTranslations("posts.debate");
  const [votes, setVotes] = useState({ a: initialA, b: initialB });
  const [mine, setMine] = useState<"a" | "b" | null>(initialVote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cast(side: "a" | "b") {
    if (busy || !signedIn) return;
    // Tapping the side you already hold takes the vote back.
    const nextSide: "a" | "b" | null = mine === side ? null : side;

    const before = { votes, mine };
    // Move the bar first: subtract the old pick, add the new one.
    setVotes((v) => {
      const copy = { ...v };
      if (mine) copy[mine] = Math.max(0, copy[mine] - 1);
      if (nextSide) copy[nextSide] += 1;
      return copy;
    });
    setMine(nextSide);
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/posts/${postId}/debate-vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: nextSide }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("voteFailed"));
      }
    } catch (err) {
      // Put it back exactly as it was — a bar showing a vote that
      // never landed is worse than no optimism at all.
      setVotes(before.votes);
      setMine(before.mine);
      setError(err instanceof Error ? err.message : t("voteFailed"));
    }
    setBusy(false);
  }

  const total = votes.a + votes.b;

  return (
    <div className="card-y2k p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="label-xbox">{t("legend")}</span>
        <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted tabular-nums">
          {t("voteBar.votes", { n: total })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { key: "a" as const, label: sideALabel, release: sideARelease },
            { key: "b" as const, label: sideBLabel, release: sideBRelease },
          ]
        ).map(({ key, label, release }) => {
          const picked = mine === key;
          const tone = key === "a" ? "accent-primary" : "accent-rose";
          return (
            <div key={key} className="space-y-2">
              {/* The side's record, when one is attached. It links out
                  on its own — the vote button is separate so tapping
                  the art never casts a vote by accident. */}
              {release && (
                <Link
                  href={`/releases/${release.slug}`}
                  className="block poster w-full aspect-square overflow-hidden rounded-lg"
                  title={release.title}
                >
                  {release.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={release.cover_image} alt={release.title} />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-3xl">
                      💿
                    </span>
                  )}
                </Link>
              )}
              <button
                type="button"
                onClick={() => void cast(key)}
                disabled={busy || !signedIn}
                aria-pressed={picked}
                className={`btn-y2k w-full !py-2 !px-3 !text-xs ${
                  picked ? "btn-y2k-primary" : "btn-y2k-outline"
                } disabled:opacity-60`}
                style={
                  picked
                    ? undefined
                    : { borderColor: `var(--${tone})`, color: `var(--${tone})` }
                }
              >
                <span className="truncate block">
                  {picked ? t("picked", { side: label }) : label}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <VoteBar
        a={votes.a}
        b={votes.b}
        sideALabel={sideALabel}
        sideBLabel={sideBLabel}
      />

      {!signedIn && (
        <p className="text-xs text-text-muted">
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="text-accent-primary hover:underline"
          >
            {t("signInToVote")}
          </Link>
        </p>
      )}
      {mine && signedIn && (
        <p className="text-[10px] text-text-muted uppercase tracking-widest pixel-text">
          {t("tapAgain")}
        </p>
      )}
      {error && <p className="text-xs text-accent-rose">{error}</p>}
    </div>
  );
}
