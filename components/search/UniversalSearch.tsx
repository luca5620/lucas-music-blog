"use client";

/**
 * UniversalSearch — one box, the whole station (Luca 2026-08-22).
 *
 * Searches everything at once: people, artists, releases, reviews,
 * debates, lists, posts — grouped results, each row linking straight
 * to its page. Lives on /search (the app's middle tab; the web
 * header's magnifier). Queries run from the browser against the
 * world-readable tables, same pattern as UserSearch on /friends —
 * RLS keeps private rows (unpublished reviews, private lists) out,
 * and we filter explicitly anyway for clarity.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import { getRatingHex, formatRating } from "@/lib/rating";

interface UserHit {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "user" | "reviewer" | "admin" | "owner" | "tester";
}
interface ArtistHit {
  slug: string;
  name: string;
  image_url: string | null;
}
interface ReleaseHit {
  id: string;
  slug: string;
  title: string;
  cover_image: string | null;
  release_type: string;
  artists: { name: string } | { name: string }[] | null;
  /** Community average (same RPC the release pages use) — attached
      after the search query resolves; null when nobody's rated it. */
  avg_rating?: number | null;
}
interface ReviewHit {
  slug: string;
  title: string;
  artist: string;
  rating: number;
  cover_image: string | null;
}
interface DebateHit {
  slug: string;
  title: string;
  side_a_label: string;
  side_b_label: string;
  status: "open" | "closed";
}
interface ListHit {
  slug: string;
  title: string;
  profiles: { username: string } | { username: string }[] | null;
}
interface PostHit {
  slug: string;
  title: string;
  video_kind: "youtube" | "tiktok" | null;
}

interface Results {
  users: UserHit[];
  artists: ArtistHit[];
  releases: ReleaseHit[];
  reviews: ReviewHit[];
  debates: DebateHit[];
  lists: ListHit[];
  posts: PostHit[];
}

const EMPTY: Results = {
  users: [],
  artists: [],
  releases: [],
  reviews: [],
  debates: [],
  lists: [],
  posts: [],
};

/** Joined rows sometimes come back as one-element arrays — unwrap. */
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const PER_SECTION = 5;

export default function UniversalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef("");

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Same hygiene as UserSearch: strip anything that could confuse
    // the LIKE pattern or the .or() filter syntax.
    const cleaned = value.trim().replace(/[^a-zA-Z0-9_ .-]/g, "");
    if (cleaned.length < 2) {
      setResults(EMPTY);
      setSearching(false);
      setSearched(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      lastQueryRef.current = cleaned;
      const supabase = createClient();
      // Escape LIKE wildcards so "_" in a name can't match anything.
      const pattern = `%${cleaned.replace(/[%_]/g, "\\$&")}%`;

      // All seven lanes at once — each degrades to [] on error so one
      // broken lane never blanks the page.
      const [users, artists, releases, reviews, debates, lists, posts] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("username, display_name, avatar_url, role")
            .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
            .limit(PER_SECTION)
            .then(({ data }) => (data as UserHit[]) ?? []),
          supabase
            .from("artists")
            .select("slug, name, image_url")
            .ilike("name", pattern)
            .limit(PER_SECTION)
            .then(({ data }) => (data as ArtistHit[]) ?? []),
          supabase
            .from("releases")
            .select(
              "id, slug, title, cover_image, release_type, artists!releases_primary_artist_id_fkey(name)",
            )
            .ilike("title", pattern)
            .limit(PER_SECTION)
            .then(async ({ data }) => {
              const hits = (data as ReleaseHit[]) ?? [];
              // Attach each release's community average so the number
              // shown in results is labeled for what it is — the
              // community's average, not one person's score (Luca
              // 2026-08-26). Any RPC hiccup just drops the ratings.
              try {
                return await Promise.all(
                  hits.map(async (h) => {
                    const { data: s } = await supabase.rpc(
                      "get_release_stats",
                      { release_uuid: h.id } as never,
                    );
                    const row = (Array.isArray(s) ? s[0] : s) as {
                      avg_rating: number | string | null;
                    } | null;
                    const avg = row?.avg_rating;
                    return {
                      ...h,
                      avg_rating:
                        avg === null || avg === undefined ? null : Number(avg),
                    };
                  }),
                );
              } catch {
                return hits;
              }
            }),
          supabase
            .from("reviews")
            .select("slug, title, artist, rating, cover_image")
            .eq("is_published", true)
            .or(`title.ilike.${pattern},artist.ilike.${pattern}`)
            .limit(PER_SECTION)
            .then(({ data }) => (data as ReviewHit[]) ?? []),
          supabase
            .from("debates")
            .select("slug, title, side_a_label, side_b_label, status")
            .or(
              `title.ilike.${pattern},side_a_label.ilike.${pattern},side_b_label.ilike.${pattern}`,
            )
            .limit(PER_SECTION)
            .then(({ data }) => (data as DebateHit[]) ?? []),
          supabase
            .from("lists")
            .select("slug, title, profiles!inner(username)")
            .eq("is_public", true)
            .ilike("title", pattern)
            .limit(PER_SECTION)
            .then(({ data }) => (data as ListHit[]) ?? []),
          supabase
            .from("posts")
            .select("slug, title, video_kind")
            .ilike("title", pattern)
            .limit(PER_SECTION)
            .then(({ data }) => (data as PostHit[]) ?? []),
        ]);

      // Ignore stale responses from older keystrokes.
      if (lastQueryRef.current !== cleaned) return;
      setResults({ users, artists, releases, reviews, debates, lists, posts });
      setSearching(false);
      setSearched(true);
    }, 300);
  }

  const total =
    results.users.length +
    results.artists.length +
    results.releases.length +
    results.reviews.length +
    results.debates.length +
    results.lists.length +
    results.posts.length;

  return (
    <div className="space-y-6">
      {/* The box */}
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-muted pointer-events-none"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search anything — people, artists, releases…"
          autoFocus
          className="form-input !pl-10 pr-24"
          aria-label="Search everything"
        />
        {searching && (
          <span className="osd-text absolute right-3 top-1/2 -translate-y-1/2 text-xs animate-pulse">
            TUNING…
          </span>
        )}
      </div>

      {/* States */}
      {!searched && !searching && (
        <p className="text-sm text-text-muted text-center py-8">
          Type at least two characters — users, artists, releases, reviews,
          debates, lists, and posts all come back at once.
        </p>
      )}
      {searched && total === 0 && !searching && (
        /* Same NO SIGNAL voice as every other empty surface. */
        <div className="panel-xbox p-8 text-center space-y-3">
          <p className="osd-text text-sm">NO SIGNAL</p>
          <p className="text-sm text-text-secondary">
            Nothing on any channel for &ldquo;{query.trim()}&rdquo;. Try an
            artist, an album, or a username.
          </p>
        </div>
      )}

      {/* ===== Users ===== */}
      {results.users.length > 0 && (
        <Section label="Users">
          {results.users.map((u) => (
            <Row key={u.username} href={`/profile/${u.username}`}>
              <Thumb src={u.avatar_url} fallback={u.username[0]} round />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-bold text-text-primary truncate">
                  {u.display_name || u.username}
                  {u.role !== "user" && <VerifiedBadge role={u.role} />}
                </span>
                <span className="block text-xs text-text-secondary truncate">
                  @{u.username}
                </span>
              </span>
            </Row>
          ))}
        </Section>
      )}

      {/* ===== Artists ===== */}
      {results.artists.length > 0 && (
        <Section label="Artists">
          {results.artists.map((a) => (
            <Row key={a.slug} href={`/artists/${a.slug}`}>
              <Thumb src={a.image_url} fallback="♪" round />
              <span className="min-w-0 flex-1 text-sm font-bold text-text-primary truncate">
                {a.name}
              </span>
            </Row>
          ))}
        </Section>
      )}

      {/* ===== Releases ===== */}
      {results.releases.length > 0 && (
        <Section label="Releases">
          {results.releases.map((r) => (
            <Row key={r.slug} href={`/releases/${r.slug}`}>
              <Thumb src={r.cover_image} fallback="💿" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-text-primary truncate">
                  {r.title}
                </span>
                <span className="block text-xs text-text-secondary truncate">
                  {one(r.artists)?.name ?? ""}
                </span>
              </span>
              {/* Rated releases show the number WITH its meaning —
                  it's the community average, not one person's take. */}
              {typeof r.avg_rating === "number" && (
                <span className="shrink-0 text-right">
                  <span
                    className="block pixel-text text-sm font-bold tabular-nums"
                    style={{ color: getRatingHex(r.avg_rating) }}
                  >
                    {formatRating(r.avg_rating)}
                  </span>
                  <span className="block pixel-text text-[8px] uppercase tracking-widest text-text-muted">
                    community avg
                  </span>
                </span>
              )}
              <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted shrink-0">
                {r.release_type.toUpperCase()}
              </span>
            </Row>
          ))}
        </Section>
      )}

      {/* ===== Reviews ===== */}
      {results.reviews.length > 0 && (
        <Section label="Reviews">
          {results.reviews.map((r) => (
            <Row key={r.slug} href={`/reviews/${r.slug}`}>
              <Thumb src={r.cover_image} fallback="★" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-text-primary truncate">
                  {r.title}
                </span>
                <span className="block text-xs text-text-secondary truncate">
                  {r.artist}
                </span>
              </span>
              <span
                className="pixel-text text-sm font-bold tabular-nums shrink-0"
                style={{ color: getRatingHex(r.rating) }}
              >
                {formatRating(r.rating)}
              </span>
            </Row>
          ))}
        </Section>
      )}

      {/* ===== Debates ===== */}
      {results.debates.length > 0 && (
        <Section label="Debates">
          {results.debates.map((d) => (
            <Row key={d.slug} href={`/debates/${d.slug}`}>
              <Thumb src={null} fallback="🎙️" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-text-primary truncate">
                  {d.title}
                </span>
                <span className="block text-xs text-text-secondary truncate">
                  {d.side_a_label} vs {d.side_b_label}
                </span>
              </span>
              {d.status === "closed" && (
                <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted shrink-0">
                  CLOSED
                </span>
              )}
            </Row>
          ))}
        </Section>
      )}

      {/* ===== Lists ===== */}
      {results.lists.length > 0 && (
        <Section label="Lists">
          {results.lists.map((l) => {
            const owner = one(l.profiles)?.username;
            if (!owner) return null;
            return (
              <Row key={`${owner}/${l.slug}`} href={`/lists/${owner}/${l.slug}`}>
                <Thumb src={null} fallback="≣" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-text-primary truncate">
                    {l.title}
                  </span>
                  <span className="block text-xs text-text-secondary truncate">
                    by @{owner}
                  </span>
                </span>
              </Row>
            );
          })}
        </Section>
      )}

      {/* ===== Posts ===== */}
      {results.posts.length > 0 && (
        <Section label="Posts">
          {results.posts.map((p) => (
            <Row key={p.slug} href={`/posts/${p.slug}`}>
              <Thumb src={null} fallback="▶" />
              <span className="min-w-0 flex-1 text-sm font-bold text-text-primary truncate">
                {p.title}
              </span>
              {p.video_kind && (
                <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted shrink-0">
                  {p.video_kind === "youtube" ? "YOUTUBE" : "TIKTOK"}
                </span>
              )}
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

/* ─── Little layout pieces ─── */

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="label-xbox">{label}</h2>
      <div className="panel-xbox divide-y divide-border-subtle">{children}</div>
    </section>
  );
}

function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-bg-elevated transition-colors"
    >
      {children}
    </Link>
  );
}

function Thumb({
  src,
  fallback,
  round = false,
}: {
  src: string | null;
  fallback: string;
  round?: boolean;
}) {
  return (
    <span
      className={`w-9 h-9 overflow-hidden bg-bg-elevated border border-border-subtle shrink-0 flex items-center justify-center ${
        round ? "rounded-full" : "rounded"
      }`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-base text-accent-primary">{fallback}</span>
      )}
    </span>
  );
}
