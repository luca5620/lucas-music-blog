import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/spotify-import";
import type { ParsedVideo } from "@/lib/video";
import type { Post, Profile, Release } from "@/lib/types/database";

/**
 * DB helpers for posts (migration 013).
 *
 * A post is a freeform blog-style writeup — looser than a review — that
 * can embed ONE YouTube/TikTok video and optionally ties to a catalog
 * release (so an AMV edit post links back to the song it's cut to).
 *
 * All reads here run through the anon key + RLS: posts are world-
 * readable, so no auth checks are needed for the getters. Writes rely
 * on RLS too — inserts only succeed as yourself, deletes only as the
 * author or staff (007-style admin policy).
 */

/* --- Shapes the UI consumes --- */

/** Profile fields we join onto post rows for attribution. */
export interface PostAuthor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Profile["role"];
}

/** The slice of the tied release the post UI renders. */
export type PostRelease = Pick<
  Release,
  "id" | "slug" | "title" | "cover_image"
> & {
  artists: { name: string } | { name: string }[] | null;
};

export interface PostWithContext extends Post {
  author: PostAuthor | null;
  release: PostRelease | null;
}

/* --- Internal: normalize Supabase's joined-row shape ---
   PostgREST returns a joined relation as an object OR a one-element
   array depending on how it infers the relationship. */
function first<T>(joined: T | T[] | null | undefined): T | null {
  if (!joined) return null;
  return Array.isArray(joined) ? joined[0] ?? null : joined;
}

/** Display name of the tied release's primary artist, if joined. */
export function postReleaseArtistName(release: PostRelease | null): string | null {
  const artist = first(release?.artists);
  return artist?.name ?? null;
}

// The release embed goes VIA releases_primary_artist_id_fkey: releases
// and artists are ALSO linked through release_artists, so an unqualified
// artists(name) embed would be ambiguous (PGRST201) — same trap as the
// reviews↔profiles double relationship.
const POST_SELECT = `*,
  profiles!posts_user_id_fkey(username, display_name, avatar_url, role),
  releases(id, slug, title, cover_image, artists!releases_primary_artist_id_fkey(name))`;

type PostRow = Post & {
  profiles: PostAuthor | PostAuthor[] | null;
  releases: PostRelease | PostRelease[] | null;
};

function withContext(row: PostRow): PostWithContext {
  const { profiles, releases, ...post } = row;
  return {
    ...post,
    author: first(profiles),
    release: first(releases),
  };
}

/**
 * True if a post slug is already taken. Used by createPost to pick a
 * unique slug (`x-by-user`, `x-by-user-2`, …) at creation time — same
 * approach as reviews.
 */
export async function postSlugTaken(slug: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Build `slugified-title-by-username`, adding -2, -3… until free. */
async function uniquePostSlug(
  title: string,
  username: string
): Promise<string | null> {
  const safeUser = username.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  // An all-symbol title slugifies to "" — fall back so the slug never
  // starts with "-by-".
  const titleSlug = slugify(title) || "post";
  const base = `${titleSlug}-by-${safeUser}`.slice(0, 140);
  if (!(await postSlugTaken(base))) return base;
  for (let n = 2; n <= 20; n++) {
    const candidate = `${base}-${n}`;
    if (!(await postSlugTaken(candidate))) return candidate;
  }
  return null; // 20 collisions means something is wrong — bail.
}

/**
 * Create a post. The slug is derived HERE (server-side) from the title
 * and author's username — the client never picks its own slug. The
 * video, if any, must arrive pre-parsed via lib/video.ts so only the
 * extracted platform id is ever stored.
 */
export async function createPost(input: {
  userId: string;
  username: string;
  title: string;
  body: string;
  video: ParsedVideo | null;
  releaseId: string | null;
  /** Validated Spotify playlist id (lib/playlist.ts), or null. */
  playlistId?: string | null;
  /** false = save as draft (migration 024). Defaults to published. */
  isPublished?: boolean;
}): Promise<Post | null> {
  // Belt-and-braces: even a pre-parsed video must be a coherent pair
  // with a sane id (the DB constraint would also reject it, but a
  // friendly null beats a cryptic insert error).
  if (input.video && (!input.video.kind || !input.video.id || input.video.id.length > 40)) {
    return null;
  }

  const slug = await uniquePostSlug(input.title, input.username);
  if (!slug) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: input.userId,
      slug,
      title: input.title,
      body: input.body,
      video_kind: input.video?.kind ?? null,
      video_id: input.video?.id ?? null,
      release_id: input.releaseId,
      // Same idea for the playlist (migration 035): only mention the
      // column when there IS one, so plain posts keep working before
      // the migration has run.
      ...(input.playlistId ? { playlist_id: input.playlistId } : {}),
      // Only mention the column when saving a DRAFT — published is the
      // column default, and omitting it keeps publishing working even
      // before migration 024 has been run in the SQL Editor.
      ...(input.isPublished === false ? { is_published: false } : {}),
    } as never)
    .select()
    .single();

  if (error || !data) return null;
  return data as Post;
}

/**
 * Update a post's editable fields. The slug stays stable (links keep
 * working even if the title changes — same rule as reviews). RLS
 * only lets authors update their own rows; the API layer re-checks.
 */
export async function updatePost(
  id: string,
  fields: {
    title: string;
    body: string;
    video: ParsedVideo | null;
    releaseId: string | null;
    /** undefined = leave the column alone (pre-035 safe); null = clear;
        string = a validated playlist id. */
    playlistId?: string | null;
    /** Omit to leave the publish state untouched. The API layer only
        passes this when it would actually flip the row (so pre-024
        databases never see the column in an UPDATE). */
    isPublished?: boolean;
  }
): Promise<Post | null> {
  // Same belt-and-braces as createPost: a video must be a coherent pair.
  if (
    fields.video &&
    (!fields.video.kind || !fields.video.id || fields.video.id.length > 40)
  ) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .update({
      title: fields.title,
      body: fields.body,
      video_kind: fields.video?.kind ?? null,
      video_id: fields.video?.id ?? null,
      release_id: fields.releaseId,
      ...(fields.playlistId !== undefined
        ? { playlist_id: fields.playlistId }
        : {}),
      ...(fields.isPublished !== undefined
        ? { is_published: fields.isPublished }
        : {}),
    } as never)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return null;
  return data as Post;
}

/**
 * One post looked up by its (globally unique) slug, with the author
 * profile and the tied release (incl. primary artist name) joined in.
 */
export async function getPostBySlug(
  slug: string
): Promise<PostWithContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return withContext(data as unknown as PostRow);
}

export async function getPostById(id: string): Promise<Post | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Post;
}

/**
 * Recent posts for the index, newest first, with author + release.
 * `before` is a created_at cursor for older pages (keyset beats OFFSET
 * on a feed that only ever grows at the top).
 */
export async function listPosts(
  limit = 24,
  before?: string
): Promise<PostWithContext[]> {
  const supabase = await createClient();
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  // Drop drafts in JS, not with .eq(): RLS already hides OTHER
  // people's drafts, so the only rows this can catch are the viewer's
  // own — and a JS check keeps the feed alive on a database where
  // migration 024 hasn't been run yet (the column simply isn't there,
  // is_published is undefined, and everything passes).
  return (data as unknown as PostRow[])
    .filter((row) => row.is_published !== false)
    .map(withContext);
}

export async function getUserPosts(
  userId: string,
  options?: { includeUnpublished?: boolean }
): Promise<Post[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];
  // Same JS draft filter as listPosts (see the comment there). The
  // mine page opts in to drafts so they can be resumed/published.
  const rows = data as Post[];
  return options?.includeUnpublished
    ? rows
    : rows.filter((row) => row.is_published !== false);
}

/** RLS authorizes this: author always, staff via 007-style policy. */
export async function deletePost(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  return !error;
}

/* ================================================================
   Likes (migration 016) — mirrors lib/db/reviews.likeReview.
   Every helper degrades to zeros if the table doesn't exist yet
   (pre-migration), so nothing crashes before 016 is applied.
   ================================================================ */

/** Toggle the viewer's like on a post. Returns the new state. */
export async function likePost(
  userId: string,
  postId: string
): Promise<{ liked: boolean; count: number }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("post_likes")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("post_likes")
      .delete()
      .eq("user_id", userId)
      .eq("post_id", postId);
  } else {
    await supabase
      .from("post_likes")
      .insert({ user_id: userId, post_id: postId } as never);
  }

  const { count } = await supabase
    .from("post_likes")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);

  return { liked: !existing, count: count ?? 0 };
}

/** Like count + whether the viewer has liked, for one post. */
export async function getPostLikeState(
  postId: string,
  viewerId?: string
): Promise<{ count: number; viewerHasLiked: boolean }> {
  const supabase = await createClient();

  const [countRes, mineRes] = await Promise.all([
    supabase
      .from("post_likes")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId),
    viewerId
      ? supabase
          .from("post_likes")
          .select("id")
          .eq("post_id", postId)
          .eq("user_id", viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    count: countRes.count ?? 0,
    viewerHasLiked: !!mineRes.data,
  };
}

/** Which of these posts the viewer has liked (heart fill-in state). */
export async function getViewerLikedPostIds(
  postIds: string[],
  viewerId?: string
): Promise<Set<string>> {
  const liked = new Set<string>();
  if (!viewerId || postIds.length === 0) return liked;

  const supabase = await createClient();
  const { data } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", viewerId)
    .in("post_id", postIds);

  for (const row of data ?? []) {
    liked.add((row as { post_id: string }).post_id);
  }
  return liked;
}

/** Like counts for a batch of posts (feeds + taste ranking). */
export async function getPostLikeCounts(
  postIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (postIds.length === 0) return counts;

  const supabase = await createClient();
  const { data } = await supabase
    .from("post_likes")
    .select("post_id")
    .in("post_id", postIds);

  for (const row of data ?? []) {
    const id = (row as { post_id: string }).post_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
