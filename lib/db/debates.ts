import { createClient } from "@/lib/supabase/server";
import type {
  Debate,
  DebateMessage,
  DebateMessageReaction,
  Profile,
  Release,
} from "@/lib/types/database";

/**
 * DB helpers for debates (migration 006).
 *
 * A debate is a topic with exactly two sides. Users cast one vote
 * (changeable — the primary key on debate_votes is (debate_id, user_id)
 * so an upsert flips it), and chat messages are stamped with the side
 * the author had voted for AT POST TIME (null = spectator).
 *
 * All reads here run through the anon key + RLS: every table involved
 * is world-readable, so no auth checks are needed for the getters.
 */

/* --- Shapes the UI consumes --- */

// The slice of a profile we join onto debates/messages. Keeping it
// narrow means less data over the wire and no accidental leaking of
// future private profile columns.
export type DebateProfile = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url" | "role"
>;

export interface VoteCounts {
  a: number;
  b: number;
}

/** The slice of a release a debate card / room needs. */
export type DebateRelease = Pick<Release, "id" | "slug" | "title" | "cover_image">;

export interface DebateWithMeta extends Debate {
  creator: DebateProfile | null;
  /** The whole-debate "pinned" release (original 006 column). */
  release: DebateRelease | null;
  /** Per-side releases (migration 039) — "Side A = X, Side B = Y". */
  side_a_release: DebateRelease | null;
  side_b_release: DebateRelease | null;
  votes: VoteCounts;
}

/* --- The select string, and why it comes in two flavours ---
   Migration 039 adds two MORE foreign keys from debates to releases
   (side_a_release_id / side_b_release_id). Once they exist, a bare
   `releases(...)` embed is AMBIGUOUS and PostgREST refuses the whole
   query — so every embed names its constraint explicitly. And until
   039 runs, the side embeds don't exist and THEY fail — so reads try
   the full select first and fall back to the legacy one, keeping
   /debates alive on either side of the migration. */
const DEBATE_SELECT_LEGACY = `*,
  profiles!debates_created_by_fkey(id, username, display_name, avatar_url, role),
  release:releases!debates_release_id_fkey(id, slug, title, cover_image)`;

const DEBATE_SELECT = `${DEBATE_SELECT_LEGACY},
  side_a_release:releases!debates_side_a_release_id_fkey(id, slug, title, cover_image),
  side_b_release:releases!debates_side_b_release_id_fkey(id, slug, title, cover_image)`;

type DebateRow = Debate & {
  profiles: DebateProfile | DebateProfile[] | null;
  release: DebateRelease | DebateRelease[] | null;
  side_a_release?: DebateRelease | DebateRelease[] | null;
  side_b_release?: DebateRelease | DebateRelease[] | null;
};

/** Run a debates query with the full select, legacy select on failure. */
async function selectDebates(
  apply: (select: string) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<DebateRow[]> {
  const full = await apply(DEBATE_SELECT);
  if (!full.error && full.data) return full.data as DebateRow[];
  const legacy = await apply(DEBATE_SELECT_LEGACY);
  if (!legacy.error && legacy.data) return legacy.data as DebateRow[];
  return [];
}

function shapeDebate(row: DebateRow, votes: VoteCounts): DebateWithMeta {
  return {
    ...row,
    creator: first(row.profiles),
    release: first(row.release),
    side_a_release: first(row.side_a_release),
    side_b_release: first(row.side_b_release),
    votes,
  };
}

export interface DebateMessageWithProfile extends DebateMessage {
  profile: DebateProfile;
}

/* --- Internal: normalize Supabase's joined-row shape ---
   PostgREST returns a joined relation as an object OR a one-element
   array depending on how it infers the relationship, so every join
   goes through this helper. */
function first<T>(joined: T | T[] | null | undefined): T | null {
  if (!joined) return null;
  return Array.isArray(joined) ? joined[0] ?? null : joined;
}

/**
 * Vote counts for a set of debates in ONE query: fetch (debate_id, side)
 * pairs and tally in JS. At our scale this beats N count queries, and
 * Postgres-side grouping via RPC would be overkill.
 */
export async function getVoteCountsFor(
  debateIds: string[]
): Promise<Map<string, VoteCounts>> {
  const map = new Map<string, VoteCounts>();
  if (debateIds.length === 0) return map;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debate_votes")
    .select("debate_id, side")
    .in("debate_id", debateIds);

  if (error || !data) return map;

  for (const row of data as { debate_id: string; side: "a" | "b" }[]) {
    const entry = map.get(row.debate_id) ?? { a: 0, b: 0 };
    entry[row.side] += 1;
    map.set(row.debate_id, entry);
  }
  return map;
}

/** Recent debates for the index page, newest first, with creator + votes. */
export async function listDebates(limit = 24): Promise<DebateWithMeta[]> {
  const supabase = await createClient();
  const rows = await selectDebates((select) =>
    supabase
      .from("debates")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(limit)
  );
  const counts = await getVoteCountsFor(rows.map((r) => r.id));
  return rows.map((row) => shapeDebate(row, counts.get(row.id) ?? { a: 0, b: 0 }));
}

/**
 * Every debate ONE member opened — drafts included (RLS shows drafts
 * only to their creator, so calling this for someone else just yields
 * their published ones). Powers the manage hub at /reviews/mine.
 */
export async function listDebatesByUser(userId: string): Promise<DebateWithMeta[]> {
  const supabase = await createClient();
  const rows = await selectDebates((select) =>
    supabase
      .from("debates")
      .select(select)
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(200)
  );
  const counts = await getVoteCountsFor(rows.map((r) => r.id));
  return rows.map((row) => shapeDebate(row, counts.get(row.id) ?? { a: 0, b: 0 }));
}

/** One debate by slug, with creator profile + attached releases + votes. */
export async function getDebateBySlug(
  slug: string
): Promise<DebateWithMeta | null> {
  const supabase = await createClient();
  const rows = await selectDebates((select) =>
    supabase.from("debates").select(select).eq("slug", slug).limit(1)
  );
  const row = rows[0];
  if (!row) return null;
  const counts = await getVoteCountsFor([row.id]);
  return shapeDebate(row, counts.get(row.id) ?? { a: 0, b: 0 });
}

/** Which side (if any) this user has voted for on a debate. */
export async function getUserVote(
  debateId: string,
  userId: string
): Promise<"a" | "b" | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("debate_votes")
    .select("side")
    .eq("debate_id", debateId)
    .eq("user_id", userId)
    .single();

  return (data as { side: "a" | "b" } | null)?.side ?? null;
}

/**
 * Latest messages for a debate room, joined with poster profiles.
 * We fetch newest-first (so LIMIT grabs the most recent 100), then
 * reverse so the UI renders oldest → newest like a chat log.
 */
export async function getDebateMessages(
  debateId: string,
  limit = 100
): Promise<DebateMessageWithProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debate_messages")
    .select(
      "*, profiles!debate_messages_user_id_fkey(id, username, display_name, avatar_url, role)"
    )
    .eq("debate_id", debateId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  type Row = DebateMessage & {
    profiles: DebateProfile | DebateProfile[] | null;
  };

  return (data as unknown as Row[])
    .map((row) => {
      const profile = first(row.profiles);
      if (!profile) return null;
      const { profiles: _drop, ...message } = row;
      void _drop;
      return { ...message, profile } as DebateMessageWithProfile;
    })
    .filter((m): m is DebateMessageWithProfile => m !== null)
    .reverse();
}

/* --- Message reactions (migration 008) --- */

/**
 * Aggregated emoji counts for a set of debate messages in ONE query:
 * fetch (message_id, emoji) pairs and tally in JS — same tradeoff as
 * getVoteCountsFor.
 */
export async function getDebateMessageReactionCounts(
  messageIds: string[]
): Promise<{ message_id: string; emoji: string; count: number }[]> {
  if (messageIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debate_message_reactions")
    .select("message_id, emoji")
    .in("message_id", messageIds);

  if (error || !data) return [];

  const buckets = new Map<
    string,
    { message_id: string; emoji: string; count: number }
  >();
  for (const r of data as { message_id: string; emoji: string }[]) {
    const key = `${r.message_id}::${r.emoji}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, { message_id: r.message_id, emoji: r.emoji, count: 1 });
    }
  }

  return Array.from(buckets.values());
}

/**
 * Reactions the current viewer has already added in this debate — used
 * to highlight active emoji chips in the UI.
 */
export async function getViewerDebateReactions(
  userId: string,
  debateId: string
): Promise<{ message_id: string; emoji: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debate_message_reactions")
    .select("message_id, emoji")
    .eq("user_id", userId)
    .eq("debate_id", debateId);

  if (error || !data) return [];
  return data as { message_id: string; emoji: string }[];
}

/**
 * Adds a reaction to a debate message. Idempotent — if the
 * (user, message, emoji) tuple already exists (caught via the unique
 * constraint on debate_message_reactions), the existing row is fetched
 * and returned instead of throwing.
 */
export async function addDebateMessageReaction(input: {
  debateId: string;
  messageId: string;
  userId: string;
  emoji: string;
}): Promise<DebateMessageReaction> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debate_message_reactions")
    .insert({
      debate_id: input.debateId,
      message_id: input.messageId,
      user_id: input.userId,
      emoji: input.emoji,
    } as never)
    .select()
    .single();

  if (!error && data) return data as DebateMessageReaction;

  // Postgres unique-violation = 23505. Fall back to fetching the existing
  // row so the call stays idempotent.
  const isUnique =
    error &&
    ((error as { code?: string }).code === "23505" ||
      /duplicate key/i.test(error.message ?? ""));

  if (isUnique) {
    const { data: existing, error: fetchErr } = await supabase
      .from("debate_message_reactions")
      .select("*")
      .eq("user_id", input.userId)
      .eq("message_id", input.messageId)
      .eq("emoji", input.emoji)
      .single();
    if (!fetchErr && existing) return existing as DebateMessageReaction;
  }

  throw new Error(
    `addDebateMessageReaction failed: ${error?.message ?? "no data returned"}`
  );
}

/** Removes the viewer's reaction from a debate message. */
export async function removeDebateMessageReaction(input: {
  userId: string;
  messageId: string;
  emoji: string;
}): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("debate_message_reactions")
    .delete()
    .eq("user_id", input.userId)
    .eq("message_id", input.messageId)
    .eq("emoji", input.emoji);
}
