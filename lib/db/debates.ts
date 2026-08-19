import { createClient } from "@/lib/supabase/server";
import type {
  Debate,
  DebateMessage,
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

export interface DebateWithMeta extends Debate {
  creator: DebateProfile | null;
  release: Pick<Release, "id" | "slug" | "title" | "cover_image"> | null;
  votes: VoteCounts;
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
  const { data, error } = await supabase
    .from("debates")
    .select(
      `*,
       profiles!debates_created_by_fkey(id, username, display_name, avatar_url, role),
       releases(id, slug, title, cover_image)`
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  type Row = Debate & {
    profiles: DebateProfile | DebateProfile[] | null;
    releases:
      | Pick<Release, "id" | "slug" | "title" | "cover_image">
      | Pick<Release, "id" | "slug" | "title" | "cover_image">[]
      | null;
  };

  const rows = data as unknown as Row[];
  const counts = await getVoteCountsFor(rows.map((r) => r.id));

  return rows.map((row) => ({
    ...row,
    creator: first(row.profiles),
    release: first(row.releases),
    votes: counts.get(row.id) ?? { a: 0, b: 0 },
  }));
}

/** One debate by slug, with creator profile + attached release + votes. */
export async function getDebateBySlug(
  slug: string
): Promise<DebateWithMeta | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debates")
    .select(
      `*,
       profiles!debates_created_by_fkey(id, username, display_name, avatar_url, role),
       releases(id, slug, title, cover_image)`
    )
    .eq("slug", slug)
    .single();

  if (error || !data) return null;

  type Row = Debate & {
    profiles: DebateProfile | DebateProfile[] | null;
    releases:
      | Pick<Release, "id" | "slug" | "title" | "cover_image">
      | Pick<Release, "id" | "slug" | "title" | "cover_image">[]
      | null;
  };
  const row = data as unknown as Row;
  const counts = await getVoteCountsFor([row.id]);

  return {
    ...row,
    creator: first(row.profiles),
    release: first(row.releases),
    votes: counts.get(row.id) ?? { a: 0, b: 0 },
  };
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
