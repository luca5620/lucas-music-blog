"use client";

/**
 * UniversalSearch — one box, the whole station (Luca 2026-08-22).
 *
 * Searches everything at once: people, artists, music, reviews,
 * Aux Wars, lists, posts — grouped results, each row linking straight
 * to its page.
 *
 * MUSIC (2026-10-22): the old "Releases" lane only searched records
 * already on PMR, so most albums simply weren't there (Luca: "there
 * are hardly any music to find... the page will get generated on the
 * spot for the users convenience instead of doing the workaround
 * through write a review"). It now runs the SAME ranked catalog search
 * as the review picker — PMR rows + all of Spotify + Genius, with
 * artists, tabs and ▶ previews — and a record that isn't on PMR yet
 * opens through /catalog/open, which creates its page and redirects. Lives on /search (the app's middle tab; the web
 * header's magnifier). Queries run from the browser against the
 * world-readable tables, same pattern as UserSearch on /friends —
 * RLS keeps private rows (unpublished reviews, private lists) out,
 * and we filter explicitly anyway for clarity.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useLocationSearch } from "@/lib/useLocationSearch";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import { getRatingHex, formatRating } from "@/lib/rating";
import {
  useCatalogSearch,
  CatalogResultList,
} from "@/components/catalog/CatalogSearch";

interface UserHit {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "user" | "reviewer" | "admin" | "owner" | "tester" | "supporter";
}
interface ArtistHit {
  slug: string;
  name: string;
  image_url: string | null;
}
interface ReviewHit {
  slug: string;
  title: string;
  artist: string;
  rating: number;
  cover_image: string | null;
}
interface AuxHit {
  slug: string;
  name: string;
  status: "lobby" | "live" | "finished";
  player_count: number;
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
  reviews: ReviewHit[];
  aux: AuxHit[];
  lists: ListHit[];
  posts: PostHit[];
}

const EMPTY: Results = {
  users: [],
  artists: [],
  reviews: [],
  aux: [],
  lists: [],
  posts: [],
};

/** Joined rows sometimes come back as one-element arrays — unwrap. */
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const PER_SECTION = 5;

export default function UniversalSearch() {
  const t = useTranslations("search");
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
    seededRef.current = true;
    try {
      const url = new URL(window.location.href);
      if (value.trim()) url.searchParams.set("q", value.trim());
      else url.searchParams.delete("q");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* URL sync is a convenience */
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Same hygiene as UserSearch: strip anything that could confuse
    // the LIKE pattern or the .or() filter syntax.
    const cleaned = value.trim().replace(/[^\p{L}\p{N}_ .-]/gu, "");
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

      // All six lanes at once — each degrades to [] on error so one
      // broken lane never blanks the page.
      const [users, artists, reviews, aux, lists, posts] =
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
            .from("reviews")
            .select("slug, title, artist, rating, cover_image")
            .eq("is_published", true)
            .or(`title.ilike.${pattern},artist.ilike.${pattern}`)
            .limit(PER_SECTION)
            .then(({ data }) => (data as ReviewHit[]) ?? []),
          // Aux battle rooms by name — public ones (RLS also lets a
          // member's own private rooms through, which is right).
          supabase
            .from("aux_rooms")
            .select("slug, name, status, player_count")
            .ilike("name", pattern)
            .order("created_at", { ascending: false })
            .limit(PER_SECTION)
            .then(({ data }) => (data as AuxHit[]) ?? []),
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
      setResults({ users, artists, reviews, aux, lists, posts });
      setSearching(false);
      setSearched(true);
    }, 300);
  }

  /* The search lives in the URL (/search?q=…) — so tapping a result
     and coming BACK lands on the same results instead of an empty box,
     and a search can be shared as a link. Seeded once on arrival. */
  const locationSearch = useLocationSearch();
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const q = new URLSearchParams(locationSearch).get("q");
    if (!q) return;
    seededRef.current = true;
    // Deferred a tick: handleChange sets state, and the seed is a
    // one-off sync with the URL, not a render-driven loop.
    const id = setTimeout(() => handleChange(q.slice(0, 120)), 0);
    return () => clearTimeout(id);
  }, [locationSearch]);

  // Music comes from the catalog search (its own debounce + fetch).
  const music = useCatalogSearch(query);
  // The record being opened (its page is created on the spot when it
  // isn't on PMR yet — takes a second, so the row says OPENING…).
  const [opening, setOpening] = useState<string | null>(null);
  const musicCount = music.results.length + music.artists.length;

  const total =
    musicCount +
    results.users.length +
    results.artists.length +
    results.reviews.length +
    results.aux.length +
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
          placeholder={t("placeholder")}
          autoFocus
          className="form-input !pl-10 pr-24"
          aria-label={t("aria")}
        />
        {(searching || music.searching) && (
          <span className="osd-text absolute right-3 top-1/2 -translate-y-1/2 text-xs animate-pulse">
            {t("tuning")}
          </span>
        )}
      </div>

      {/* States */}
      {!searched && !searching && (
        <p className="text-sm text-text-muted text-center py-8">
          {t("hint")}
        </p>
      )}
      {searched && total === 0 && !searching && !music.searching && (
        /* Same NO SIGNAL voice as every other empty surface. */
        <div className="panel-xbox p-8 text-center space-y-3">
          <p className="osd-text text-sm">{t("noSignal")}</p>
          <p className="text-sm text-text-secondary">
            {t("nothing", { query: query.trim() })}
          </p>
        </div>
      )}

      {/* ===== Music — every album/song/artist, on PMR or not ===== */}
      {musicCount > 0 && (
        <section className="space-y-2">
          <h2 className="label-xbox">{t("sections.music")}</h2>
          <CatalogResultList
            results={music.results}
            artists={music.artists}
            query={music.searchedFor}
            linkMode
            busyKey={opening}
            onSelect={(r) => setOpening(`${r.source}:${r.id}`)}
          />
          <p className="text-[11px] text-text-muted">{t("musicHint")}</p>
        </section>
      )}

      {/* ===== Users ===== */}
      {results.users.length > 0 && (
        <Section label={t("sections.users")}>
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
        <Section label={t("sections.artists")}>
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

      {/* ===== Reviews ===== */}
      {results.reviews.length > 0 && (
        <Section label={t("sections.reviews")}>
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

      {/* ===== Aux battles ===== */}
      {results.aux.length > 0 && (
        <Section label={t("sections.auxBattles")}>
          {results.aux.map((r) => (
            <Row key={r.slug} href={`/aux-wars/${r.slug}`}>
              <Thumb src={null} fallback="🎧" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-text-primary truncate">
                  {r.name}
                </span>
                <span className="block text-xs text-text-secondary truncate">
                  {t("auxPlayers", { n: r.player_count })}
                </span>
              </span>
              <span
                className={`pixel-text text-[10px] uppercase tracking-widest shrink-0 ${
                  r.status === "live" ? "text-[#ff4455]" : "text-text-muted"
                }`}
              >
                {r.status === "live" ? t("auxLive") : r.status === "lobby" ? t("auxLobby") : t("closed")}
              </span>
            </Row>
          ))}
        </Section>
      )}

      {/* ===== Lists ===== */}
      {results.lists.length > 0 && (
        <Section label={t("sections.lists")}>
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
                    {t("byOwner", { owner })}
                  </span>
                </span>
              </Row>
            );
          })}
        </Section>
      )}

      {/* ===== Posts ===== */}
      {results.posts.length > 0 && (
        <Section label={t("sections.posts")}>
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
