/**
 * Shared validation for the DEBATE half of a post (migration 048).
 *
 * Both /api/posts (create) and /api/posts/[postId] (edit) run the
 * same rules, so they live here rather than being written twice and
 * drifting apart:
 *
 *   - a debate is BOTH labels or NEITHER — never one
 *   - labels are 1–40 characters after trimming
 *   - the two sides have to actually disagree (labels must differ)
 *   - each side's release, if given, must be a real catalog row
 *
 * Returns either the bag the DB layer wants, `null` for "this post is
 * not a debate", or a message to send back as a 400.
 */

import { isUuid } from "@/lib/validate";
import { getReleaseById } from "@/lib/db/releases";
import type { PostDebateInput } from "@/lib/db/posts";

export type DebateParse =
  | { ok: true; debate: PostDebateInput | null }
  | { ok: false; error: string };

export async function parsePostDebate(payload: {
  side_a_label?: unknown;
  side_b_label?: unknown;
  side_a_release_id?: unknown;
  side_b_release_id?: unknown;
}): Promise<DebateParse> {
  const rawA = typeof payload.side_a_label === "string" ? payload.side_a_label.trim() : "";
  const rawB = typeof payload.side_b_label === "string" ? payload.side_b_label.trim() : "";

  // Neither side: a plain post.
  if (!rawA && !rawB) return { ok: true, debate: null };

  if (!rawA || !rawB) {
    return { ok: false, error: "A debate needs both sides — fill in the second one or clear the first." };
  }
  if (rawA.length > 40 || rawB.length > 40) {
    return { ok: false, error: "Each side is 40 characters or fewer." };
  }
  if (rawA.toLowerCase() === rawB.toLowerCase()) {
    return { ok: false, error: "The two sides have to actually disagree — give them different labels." };
  }

  const ids: (string | null)[] = [];
  for (const raw of [payload.side_a_release_id, payload.side_b_release_id]) {
    if (raw == null || raw === "") {
      ids.push(null);
      continue;
    }
    if (!isUuid(raw)) return { ok: false, error: "Invalid release on one of the sides." };
    const release = await getReleaseById(raw as string);
    if (!release) return { ok: false, error: "A release attached to a side doesn't exist." };
    ids.push(release.id);
  }

  return {
    ok: true,
    debate: {
      sideALabel: rawA,
      sideBLabel: rawB,
      sideAReleaseId: ids[0],
      sideBReleaseId: ids[1],
    },
  };
}
