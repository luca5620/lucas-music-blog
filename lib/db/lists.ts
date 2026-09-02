import { createClient } from "@/lib/supabase/server";
import type { List, ListItem } from "@/lib/types/database";

/* ============================================
   Lists — data access layer (migration 004)

   All functions run on the server through the Supabase client from
   lib/supabase/server.ts, which carries the viewer's session cookie.
   That means Row Level Security applies automatically:
   - private lists are only visible to their owner
   - writes only succeed for the owner
   The API routes still do explicit ownership checks so we can return
   friendly 403 errors instead of silent RLS failures.
   ============================================ */

/* --- Shapes returned to the UI --- */

/** The author info we join onto lists for cards and detail pages. */
export interface ListAuthor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** A list plus everything a browse card needs (covers, counts, author). */
export interface ListSummary extends List {
  author: ListAuthor;
  /** Up to 5 item cover images, in list order, for the fanned stack. */
  item_covers: string[];
  item_count: number;
  like_count: number;
}

/** A full list with its items, for the detail page. */
/** A list item plus where clicking it should go, if anywhere. */
export interface ListItemWithLink extends ListItem {
  /** The joined release's slug — the direct link target. Null for
      playlist imports that haven't been resolved into the catalog
      yet; those fall back to spotify_album_id. */
  release_slug: string | null;
}

export interface ListWithItems extends List {
  author: ListAuthor;
  items: ListItemWithLink[];
  like_count: number;
  viewer_has_liked: boolean;
}

/* --- Internal helpers --- */

/** A list_items row as it comes back with the releases(slug) embed. */
type ItemRow = ListItem & {
  releases: { slug: string } | { slug: string }[] | null;
};

/**
 * Shape of a raw row when we select lists with joined profile,
 * items, and like counts. Supabase's join typing is loose, so we
 * describe it ourselves and cast.
 */
type RawListRow = List & {
  profiles:
    | ListAuthor
    | ListAuthor[]
    | null;
  list_items: { cover_image: string | null; position: number }[] | null;
  list_likes: { count: number }[] | null;
};

/** Normalize one raw joined row into a ListSummary. */
function toSummary(row: RawListRow): ListSummary {
  // Supabase sometimes types a joined row as an array — unwrap it.
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  // Sort items by position, keep only ones with a cover, take five.
  const items = [...(row.list_items ?? [])].sort(
    (a, b) => a.position - b.position
  );
  const covers = items
    .map((i) => i.cover_image)
    .filter((c): c is string => !!c)
    .slice(0, 5);

  const { profiles, list_items, list_likes, ...list } = row;
  void profiles;

  return {
    ...(list as List),
    author: {
      username: profile?.username ?? "",
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    },
    item_covers: covers,
    item_count: list_items?.length ?? 0,
    like_count: Array.isArray(list_likes) ? list_likes[0]?.count ?? 0 : 0,
  };
}

// The select string shared by the browse queries: the list itself,
// author profile, item covers (for the fan), and a like count.
const SUMMARY_SELECT =
  "*, profiles!inner(username, display_name, avatar_url), list_items(cover_image, position), list_likes(count)";

/* --- Reads --- */

/**
 * Recent public lists for the browse page, newest first.
 */
export async function getPublicLists(options?: {
  limit?: number;
  offset?: number;
}): Promise<ListSummary[]> {
  const supabase = await createClient();
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const { data, error } = await supabase
    .from("lists")
    .select(SUMMARY_SELECT)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return [];
  return (data as unknown as RawListRow[]).map(toSummary);
}

/**
 * All lists by a given username. RLS means visitors only see the
 * public ones, while the owner also sees their private lists.
 */
export async function getListsByUsername(
  username: string
): Promise<ListSummary[]> {
  const supabase = await createClient();

  // Resolve the username to a profile id first.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .single();

  if (!profile) return [];

  const { data, error } = await supabase
    .from("lists")
    .select(SUMMARY_SELECT)
    .eq("user_id", (profile as { id: string }).id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as unknown as RawListRow[]).map(toSummary);
}

/**
 * One list (by owner username + slug) with its items ordered by
 * position — everything the detail page needs. Pass the viewer's id
 * to also learn whether they've liked it.
 *
 * Returns null when the list doesn't exist OR when RLS hides it
 * (a private list viewed by someone who isn't the owner).
 */
export async function getListBySlug(
  username: string,
  slug: string,
  viewerId?: string
): Promise<ListWithItems | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", username)
    .single();

  if (!profile) return null;
  const author = profile as ListAuthor & { id: string };

  const { data: listData, error } = await supabase
    .from("lists")
    .select("*")
    .eq("user_id", author.id)
    .eq("slug", slug)
    .single();

  if (error || !listData) return null;
  const list = listData as List;

  // Items, like count, and (optionally) the viewer's like — in parallel.
  const [itemsRes, likesRes, viewerLikeRes] = await Promise.all([
    // releases(slug) rides along so the page can LINK each item to its
    // release (2026-09-02 — items used to render as dead cards). The
    // embed is a left join: items with no release_id, and playlist
    // imports that resolve lazily, just come back with releases null.
    supabase
      .from("list_items")
      .select("*, releases(slug)")
      .eq("list_id", list.id)
      .order("position", { ascending: true }),
    supabase
      .from("list_likes")
      .select("id", { count: "exact", head: true })
      .eq("list_id", list.id),
    viewerId
      ? supabase
          .from("list_likes")
          .select("id")
          .eq("list_id", list.id)
          .eq("user_id", viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...list,
    author: {
      username: author.username,
      display_name: author.display_name,
      avatar_url: author.avatar_url,
    },
    items: ((itemsRes.data ?? []) as unknown as ItemRow[]).map((row) => {
      const { releases, ...item } = row;
      // PostgREST hands an embed back as an object OR a one-element
      // array depending on how it infers the relationship.
      const joined = Array.isArray(releases) ? releases[0] ?? null : releases;
      return { ...item, release_slug: joined?.slug ?? null };
    }),
    like_count: likesRes.count ?? 0,
    viewer_has_liked: !!viewerLikeRes.data,
  };
}

/** Fetch a single list by id (used by API routes for ownership checks). */
export async function getListById(id: string): Promise<List | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lists")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as List;
}

/** Fetch a single list item by id (for the item API routes). */
export async function getListItemById(id: string): Promise<ListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("list_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as ListItem;
}

/* --- Writes: lists --- */

export async function createList(input: {
  user_id: string;
  slug: string;
  title: string;
  description?: string | null;
  is_ranked?: boolean;
  is_public?: boolean;
}): Promise<List | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lists")
    .insert(input as never)
    .select()
    .single();

  if (error || !data) return null;
  return data as List;
}

export async function updateList(
  id: string,
  updates: Partial<
    Pick<List, "title" | "slug" | "description" | "is_ranked" | "is_public">
  >
): Promise<List | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lists")
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return null;
  return data as List;
}

export async function deleteList(id: string): Promise<boolean> {
  const supabase = await createClient();
  // list_items and list_likes cascade-delete with the list (FK "on delete cascade").
  //
  // .select() on the delete so we get the rows that actually went.
  // Under RLS a delete the policies don't allow removes ZERO rows and
  // raises NO error — `!error` alone reported success while the list
  // sat there (the 021 restrictive-policy bug, 2026-09-02). Now
  // "nothing was deleted" is a failure the API can say out loud.
  const { data, error } = await supabase
    .from("lists")
    .delete()
    .eq("id", id)
    .select("id");
  return !error && (data?.length ?? 0) > 0;
}

/* --- Writes: items --- */

export async function addListItem(input: {
  list_id: string;
  release_id?: string | null;
  title: string;
  artist: string;
  cover_image?: string | null;
  note?: string | null;
  position: number;
  /** Playlist imports only (migration 037): the album this track came
      from, so the item can resolve to a real release on first click.
      Omit it entirely on a pre-037 database — sending an unknown
      column fails the whole insert. */
  spotify_album_id?: string | null;
}): Promise<ListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("list_items")
    .insert(input as never)
    .select()
    .single();

  if (error || !data) return null;
  return data as ListItem;
}

export async function updateListItem(
  id: string,
  updates: Partial<Pick<ListItem, "note" | "position">>
): Promise<ListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("list_items")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return null;
  return data as ListItem;
}

export async function removeListItem(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("list_items").delete().eq("id", id);
  return !error;
}

/**
 * Rewrite the positions of a list's items to match the given order.
 * orderedItemIds[0] gets position 0, [1] gets position 1, and so on.
 * Items are matched by BOTH id and list_id so you can't sneak in an
 * item that belongs to a different list.
 */
export async function reorderListItems(
  listId: string,
  orderedItemIds: string[]
): Promise<boolean> {
  const supabase = await createClient();

  const results = await Promise.all(
    orderedItemIds.map((itemId, index) =>
      supabase
        .from("list_items")
        .update({ position: index } as never)
        .eq("id", itemId)
        .eq("list_id", listId)
    )
  );

  return results.every((r) => !r.error);
}

/* --- Likes --- */

/**
 * Toggle the viewer's like on a list (same pattern as review likes).
 * Returns the new state plus the fresh count for the UI.
 */
export async function toggleListLike(
  userId: string,
  listId: string
): Promise<{ liked: boolean; count: number }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("list_likes")
    .select("id")
    .eq("user_id", userId)
    .eq("list_id", listId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("list_likes")
      .delete()
      .eq("user_id", userId)
      .eq("list_id", listId);
  } else {
    await supabase
      .from("list_likes")
      .insert({ user_id: userId, list_id: listId } as never);
  }

  const { count } = await supabase
    .from("list_likes")
    .select("id", { count: "exact", head: true })
    .eq("list_id", listId);

  return { liked: !existing, count: count ?? 0 };
}

/* --- Slug helpers --- */

/**
 * Turn a title into a URL-friendly slug:
 * lowercase, non-alphanumerics collapsed into hyphens, trimmed.
 * "Best of 2026!!" -> "best-of-2026"
 */
export function slugifyListTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Find a slug that's free for this user. Slugs are unique per user
 * (uq_lists_user_slug), so on collision we append -2, -3, ...
 */
export async function generateUniqueListSlug(
  userId: string,
  title: string
): Promise<string> {
  const supabase = await createClient();
  const base = slugifyListTitle(title) || "list";

  // Grab every existing slug that starts with the base, in one query,
  // then probe base, base-2, base-3... locally until one is free.
  const { data } = await supabase
    .from("lists")
    .select("slug")
    .eq("user_id", userId)
    .like("slug", `${base}%`);

  const taken = new Set(((data ?? []) as { slug: string }[]).map((r) => r.slug));

  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
