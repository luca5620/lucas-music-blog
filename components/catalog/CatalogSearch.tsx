"use client";

/**
 * CatalogSearch — the one way anything enters the platform.
 *
 * Type → ranked results from the local catalog, Spotify (albums, songs,
 * artists) and Genius songs (deep catalog incl. unreleased) → pick one
 * → the release is imported on demand and the full local row is handed
 * to `onPick`. No manual title/artist/cover fields exist anywhere.
 *
 * Round 2 (Luca 2026-10-22: "improved search for writing reviews, this
 * should be very intuitive, find by artist, album, etc"):
 *   - results are RANKED by how well they match what you typed (exact
 *     title first: "Rappels" above "Rappels 2") — lib/catalog-rank.ts
 *   - tabs: All · Albums · Songs · Artists
 *   - ARTISTS: tap one and their whole discography opens right here
 *   - ▶ on every cover plays a 30s preview ("huh, what does this song
 *     sound like again?") — lib/preview-player.ts
 *   - the words you typed are highlighted in each result
 *   - albums show their track count, songs show which record they're on
 *     — that's how two editions / six copies of a song are told apart
 *   - ↑ ↓ Enter Esc work from the keyboard
 *   - "Paste a Spotify link" button: the door for upcoming albums AND
 *     for the old records Spotify hides from search (Téléphone's
 *     Rappels — see lib/catalog.ts)
 *
 * The pieces are exported for the /search page too: `useCatalogSearch`
 * (the fetching) and `CatalogResultList` (the list), which there links
 * each result to its page instead of picking it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Release } from "@/lib/types/database";
import { getRatingHex, formatRating } from "@/lib/rating";
import { foldText } from "@/lib/catalog-rank";
import { stopPreview } from "@/lib/preview-player";
import PreviewButton from "@/components/catalog/PreviewButton";
import { useTranslations } from "next-intl";

export interface CatalogResult {
  source: "local" | "spotify" | "spotify_track" | "genius";
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  year: string | null;
  kind: string;
  slug?: string;
  unreleased?: boolean;
  /** Release date is in the future — a countdown/pre-save album. */
  upcoming?: boolean;
  /** Community average for releases already on PMR — shown labeled
      so the number can't be mistaken for one person's score. */
  avg_rating?: number | null;
  /** Track count (albums/EPs). */
  tracks?: number;
  /** Songs: the record they're on. */
  album?: string;
}

export interface CatalogArtist {
  id: string;
  name: string;
  image: string | null;
  genres: string[];
}

export interface CatalogPick {
  release: Release;
  artist_name: string;
}

interface CatalogSearchProps {
  onPick: (pick: CatalogPick) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Optional label shown above the input. */
  label?: string;
}

// `text` for "local" is a key into messages → catalog; the others are
// service names and stay as they are.
const SOURCE_BADGE: Record<CatalogResult["source"], { text: string; cls: string }> = {
  local: { text: "onPmr", cls: "text-accent-glow border-accent-primary/40" },
  // Spotify stays brand-green (Luca 2026-08-25) — the sitewide
  // green→blue recolor deliberately skips this one badge.
  spotify: { text: "SPOTIFY", cls: "text-osd-green border-osd-green/40" },
  spotify_track: { text: "SPOTIFY", cls: "text-osd-green border-osd-green/40" },
  genius: { text: "GENIUS", cls: "text-osd-amber border-osd-amber/40" },
};

/** One song (a song hit, or a one-track single) vs a whole record. */
export function isSong(r: CatalogResult): boolean {
  return r.kind === "song" || (r.kind === "single" && (r.tracks ?? 1) <= 1);
}

const resultKey = (r: CatalogResult) => `${r.source}:${r.id}`;

/* ==================================================================
   useCatalogSearch — debounced fetch of /api/search/catalog
   ================================================================== */

export function useCatalogSearch(query: string, delayMs = 300) {
  const t = useTranslations("catalog");
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [artists, setArtists] = useState<CatalogArtist[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  // The query the CURRENT results belong to ("" = nothing searched).
  const [searchedFor, setSearchedFor] = useState("");
  const lastQueryRef = useRef("");

  useEffect(() => {
    const q = query.trim();
    lastQueryRef.current = q;
    if (q.length < 2) {
      setResults([]);
      setArtists([]);
      setNotice(null);
      setError(null);
      setSearching(false);
      setSearchedFor("");
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/catalog?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as {
          results: CatalogResult[];
          artists?: CatalogArtist[];
          notice?: string;
        };
        // A slower response for an older query must never clobber results.
        if (lastQueryRef.current !== q) return;
        setResults(data.results);
        setArtists(data.artists ?? []);
        setNotice(data.notice ?? null);
        setError(null);
        setSearchedFor(q);
      } catch {
        if (lastQueryRef.current === q) setError(t("hiccup"));
      } finally {
        if (lastQueryRef.current === q) setSearching(false);
      }
    }, delayMs);
    return () => clearTimeout(timer);
  }, [query, delayMs, t]);

  return { results, artists, notice, error, searching, searchedFor };
}

/* ==================================================================
   Highlight — bold the typed words inside a title/artist line
   ================================================================== */

/**
 * Accent-blind: typing "telephone" lights up "Téléphone". Works by
 * folding the text one character at a time and remembering where each
 * folded character came from, so the marks land on the ORIGINAL text.
 * Only matches at the start of a word ("rap" lights "Rappels", not the
 * "rap" inside "Trappalachia").
 */
function Highlight({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => {
    const qWords = foldText(query).split(" ").filter((w) => w.length >= 1);
    if (qWords.length === 0 || !text) return [{ s: text, hit: false }];

    let folded = "";
    const from: number[] = []; // folded index → original index
    [...text].forEach((ch, i) => {
      const f = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      for (const c of f) {
        folded += c;
        from.push(i);
      }
    });
    const chars = [...text];
    const marked = new Array<boolean>(chars.length).fill(false);
    const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
    for (const w of qWords) {
      let at = folded.indexOf(w);
      while (at !== -1) {
        if (!isWordChar(folded[at - 1])) {
          for (let k = at; k < at + w.length; k++) marked[from[k]] = true;
        }
        at = folded.indexOf(w, at + 1);
      }
    }
    const out: { s: string; hit: boolean }[] = [];
    chars.forEach((c, i) => {
      const last = out[out.length - 1];
      if (last && last.hit === marked[i]) last.s += c;
      else out.push({ s: c, hit: marked[i] });
    });
    return out;
  }, [text, query]);

  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="bg-transparent text-accent-glow">
            {p.s}
          </mark>
        ) : (
          <span key={i}>{p.s}</span>
        )
      )}
    </>
  );
}

/* ==================================================================
   CatalogResultList — tabs, sections, discographies, rows
   ================================================================== */

type Tab = "all" | "albums" | "songs" | "artists";

interface ResultListProps {
  results: CatalogResult[];
  artists: CatalogArtist[];
  /** What was typed — for highlighting. */
  query: string;
  /** Picker mode: tap = pick. */
  onSelect?: (r: CatalogResult) => void;
  /** Browse mode (the /search page): each row links to its page. */
  linkMode?: boolean;
  /** The row being imported right now (shows LOADING…). */
  busyKey?: string | null;
  /** Input to drive ↑ ↓ Enter Esc from (picker mode). */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onEscape?: () => void;
  /** Picker panel: cap the height and scroll inside. */
  scroll?: boolean;
}

export function CatalogResultList({
  results,
  artists,
  query,
  onSelect,
  linkMode = false,
  busyKey = null,
  inputRef,
  onEscape,
  scroll = false,
}: ResultListProps) {
  const t = useTranslations("catalog");
  const [tab, setTab] = useState<Tab>("all");
  const [disco, setDisco] = useState<{
    artist: CatalogArtist;
    results: CatalogResult[] | null;
    failed?: boolean;
  } | null>(null);
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  // New search → back to the All tab, out of any discography.
  useEffect(() => {
    setTab("all");
    setDisco(null);
    setActive(-1);
  }, [query]);

  // Leaving the list (picked, closed, navigated) silences any preview.
  useEffect(() => () => stopPreview(), []);

  const albums = useMemo(() => results.filter((r) => !isSong(r)), [results]);
  const songs = useMemo(() => results.filter(isSong), [results]);

  async function openArtist(a: CatalogArtist) {
    setDisco({ artist: a, results: null });
    setActive(-1);
    try {
      const res = await fetch(`/api/search/catalog?artist=${encodeURIComponent(a.id)}`);
      if (!res.ok) throw new Error("disco failed");
      const data = (await res.json()) as { results: CatalogResult[] };
      setDisco((d) => (d && d.artist.id === a.id ? { ...d, results: data.results } : d));
    } catch {
      setDisco((d) => (d && d.artist.id === a.id ? { ...d, results: [], failed: true } : d));
    }
    listRef.current?.scrollTo({ top: 0 });
  }

  // What's on screen, in order — the keyboard walks this.
  const best = results[0];
  const visible: CatalogResult[] = useMemo(
    () =>
      disco
        ? (disco.results ?? [])
        : tab === "albums"
          ? albums
          : tab === "songs"
            ? songs
            : tab === "artists"
              ? []
              : [
                  ...(best ? [best] : []),
                  ...albums.filter((r) => r !== best).slice(0, 4),
                  ...songs.filter((r) => r !== best).slice(0, 5),
                ],
    [disco, tab, albums, songs, best]
  );

  // Keyboard: ↑ ↓ move, Enter picks, Esc closes. Bound to the input
  // so typing and choosing never leave the keyboard.
  useEffect(() => {
    const el = inputRef?.current;
    if (!el || !onSelect) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(visible.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(-1, i - 1));
      } else if (e.key === "Enter" && active >= 0 && visible[active]) {
        e.preventDefault();
        onSelect?.(visible[active]);
      } else if (e.key === "Escape") {
        onEscape?.();
      }
    }
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [inputRef, onSelect, onEscape, visible, active]);

  // Keep the highlighted row in view.
  useEffect(() => {
    if (active < 0) return;
    listRef.current
      ?.querySelector(`[data-row="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const row = (r: CatalogResult, big = false) => {
    const index = visible.indexOf(r);
    return (
      <ResultRow
        key={resultKey(r)}
        r={r}
        query={query}
        big={big}
        index={index}
        active={index === active}
        busy={busyKey === resultKey(r)}
        disabled={busyKey !== null}
        onSelect={onSelect}
        linkMode={linkMode}
      />
    );
  };

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: "all", label: t("tabs.all"), n: results.length + artists.length },
    { id: "albums", label: t("tabs.albums"), n: albums.length },
    { id: "songs", label: t("tabs.songs"), n: songs.length },
    { id: "artists", label: t("tabs.artists"), n: artists.length },
  ];

  return (
    <div className="rounded-lg border border-border-medium bg-[#0c0c0f] shadow-[0_16px_50px_rgba(0,0,0,0.8)] overflow-hidden">
      {/* Header: tabs, or the discography's back bar */}
      {disco ? (
        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border-subtle bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setDisco(null)}
            className="label-xbox text-[0.65rem] hover:text-accent-primary transition-colors shrink-0"
          >
            ← {t("back")}
          </button>
          <span className="w-8 h-8 rounded-full overflow-hidden bg-bg-elevated border border-border-subtle shrink-0">
            {disco.artist.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={disco.artist.image} alt="" className="w-full h-full object-cover" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-text-primary truncate">
              {disco.artist.name}
            </span>
            <span className="block pixel-text text-[9px] uppercase tracking-widest text-text-muted">
              {t("discography")}
            </span>
          </span>
        </div>
      ) : (
        <div
          role="tablist"
          className="flex gap-1 px-2 pt-2 pb-1.5 border-b border-border-subtle overflow-x-auto no-scrollbar"
        >
          {tabs
            .filter((x) => x.id === "all" || x.n > 0)
            .map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={tab === x.id}
                onClick={() => {
                  setTab(x.id);
                  setActive(-1);
                  listRef.current?.scrollTo({ top: 0 });
                }}
                className={`catalog-tab shrink-0 ${tab === x.id ? "catalog-tab-on" : ""}`}
              >
                {x.label}
                {x.id !== "all" && <span className="catalog-tab-n">{x.n}</span>}
              </button>
            ))}
        </div>
      )}

      <div ref={listRef} className={scroll ? "max-h-[26rem] overflow-y-auto overscroll-contain" : ""}>
        {disco ? (
          disco.results === null ? (
            <SkeletonRows n={5} />
          ) : disco.results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted text-center">
              {disco.failed ? t("hiccup") : t("noDiscography")}
            </p>
          ) : (
            <div className="divide-y divide-border-subtle">{disco.results.map((r) => row(r))}</div>
          )
        ) : tab === "artists" ? (
          <div className="divide-y divide-border-subtle">
            {artists.map((a) => (
              <ArtistRow key={a.id} a={a} query={query} onOpen={() => openArtist(a)} />
            ))}
          </div>
        ) : tab === "albums" ? (
          <div className="divide-y divide-border-subtle">{albums.map((r) => row(r))}</div>
        ) : tab === "songs" ? (
          <div className="divide-y divide-border-subtle">{songs.map((r) => row(r))}</div>
        ) : (
          <>
            {best && (
              <Section label={t("bestMatch")}>{row(best, true)}</Section>
            )}
            {artists.length > 0 && (
              <Section label={t("artistsSection")}>
                {/* Chips, not rows: an artist is a door to their
                    records, not a record — so it reads differently. */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 pb-3 pt-1">
                  {artists.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => openArtist(a)}
                      className="artist-chip shrink-0"
                    >
                      <span className="w-7 h-7 rounded-full overflow-hidden bg-bg-elevated shrink-0">
                        {a.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.image} alt="" className="w-full h-full object-cover" />
                        )}
                      </span>
                      <span className="text-sm font-bold text-text-primary whitespace-nowrap">
                        {a.name}
                      </span>
                      <span className="pixel-text text-[9px] uppercase tracking-widest text-text-muted whitespace-nowrap">
                        {t("seeRecords")} →
                      </span>
                    </button>
                  ))}
                </div>
              </Section>
            )}
            {albums.filter((r) => r !== best).length > 0 && (
              <Section
                label={t("albumsSection")}
                more={albums.length > 5 ? { n: albums.length, go: () => setTab("albums") } : undefined}
              >
                <div className="divide-y divide-border-subtle">
                  {albums.filter((r) => r !== best).slice(0, 4).map((r) => row(r))}
                </div>
              </Section>
            )}
            {songs.filter((r) => r !== best).length > 0 && (
              <Section
                label={t("songsSection")}
                more={songs.length > 6 ? { n: songs.length, go: () => setTab("songs") } : undefined}
              >
                <div className="divide-y divide-border-subtle">
                  {songs.filter((r) => r !== best).slice(0, 5).map((r) => row(r))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  more,
  children,
}: {
  label: string;
  more?: { n: number; go: () => void };
  children: React.ReactNode;
}) {
  const t = useTranslations("catalog");
  return (
    <section className="border-b border-border-subtle last:border-b-0">
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <h3 className="pixel-text text-[10px] uppercase tracking-[0.2em] text-text-muted">
          {label}
        </h3>
        {more && (
          <button
            type="button"
            onClick={more.go}
            className="pixel-text text-[10px] uppercase tracking-widest text-accent-primary hover:text-accent-glow"
          >
            {t("seeAll", { n: more.n })}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="divide-y divide-border-subtle" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <span className="catalog-skel w-14 h-14 rounded" />
          <span className="flex-1 space-y-2">
            <span className="catalog-skel block h-3.5 w-2/3 rounded" />
            <span className="catalog-skel block h-3 w-1/3 rounded" />
          </span>
        </div>
      ))}
    </div>
  );
}

function ArtistRow({
  a,
  query,
  onOpen,
}: {
  a: CatalogArtist;
  query: string;
  onOpen: () => void;
}) {
  const t = useTranslations("catalog");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-bg-elevated transition-colors"
    >
      <span className="w-14 h-14 rounded-full overflow-hidden bg-bg-elevated shrink-0 border border-border-subtle flex items-center justify-center">
        {a.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl text-accent-primary">♪</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-text-primary truncate">
          <Highlight text={a.name} query={query} />
        </span>
        <span className="block text-sm text-text-secondary truncate">
          {[t("artistKind"), ...a.genres].join(" · ")}
        </span>
      </span>
      <span className="pixel-text text-[10px] uppercase tracking-widest text-accent-primary shrink-0">
        {t("seeRecords")} →
      </span>
    </button>
  );
}

function ResultRow({
  r,
  query,
  big,
  index,
  active,
  busy,
  disabled,
  onSelect,
  linkMode,
}: {
  r: CatalogResult;
  query: string;
  big: boolean;
  index: number;
  active: boolean;
  busy: boolean;
  disabled: boolean;
  onSelect?: (r: CatalogResult) => void;
  linkMode: boolean;
}) {
  const t = useTranslations("catalog");
  const badge = SOURCE_BADGE[r.source];
  const song = isSong(r);

  // Second line: artist · year · what it is. Songs say which record
  // they're on; albums how many tracks — the edition tellers.
  const meta = [
    r.year,
    song ? (r.album && foldText(r.album) !== foldText(r.title) ? t("onAlbum", { album: r.album }) : t("kinds.song")) : t(`kinds.${kindKey(r.kind)}`),
    !song && r.tracks ? t("tracksCount", { n: r.tracks }) : null,
  ].filter(Boolean);

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className={`block font-bold text-text-primary truncate ${big ? "text-lg" : "text-base"}`}>
          <Highlight text={r.title} query={query} />
        </span>
        <span className="block text-sm text-text-secondary truncate">
          {r.artist && (
            <>
              <Highlight text={r.artist} query={query} />
              {" · "}
            </>
          )}
          {meta.join(" · ")}
        </span>
        {/* Stamps on their own line on phones so titles keep their room. */}
        {(r.unreleased || r.upcoming) && (
          <span className="flex gap-1 mt-1">
            {r.unreleased && (
              <span className="pixel-text text-[10px] text-osd-amber border border-osd-amber/40 rounded px-1 py-0.5">
                {t("unreleased")}
              </span>
            )}
            {/* Future release_date — the countdown-album case. */}
            {r.upcoming && (
              <span className="pixel-text text-[10px] text-osd-amber border border-osd-amber/40 rounded px-1 py-0.5 animate-pulse">
                {t("dropsSoon")}
              </span>
            )}
          </span>
        )}
      </span>

      {/* Releases already on PMR with ratings show the community
          average, labeled as exactly that (Luca 2026-08-26: never let a
          bare number read like one person's score). */}
      {typeof r.avg_rating === "number" && (
        <span className="text-right shrink-0">
          <span
            className="block pixel-text text-sm font-bold tabular-nums"
            style={{ color: getRatingHex(r.avg_rating) }}
          >
            {formatRating(r.avg_rating)}
          </span>
          <span className="block pixel-text text-[8px] uppercase tracking-widest text-text-muted">
            {t("communityAvg")}
          </span>
        </span>
      )}

      <span className={`pixel-text text-[10px] border rounded px-1 py-0.5 shrink-0 ${badge.cls}`}>
        {busy
          ? linkMode
            ? t("opening")
            : t("loading")
          : r.source === "local"
            ? t("onPmr")
            : badge.text}
      </span>
    </>
  );

  const rowCls = `flex-1 min-w-0 flex items-center gap-3 py-3 pr-3 text-left transition-colors disabled:opacity-60`;
  const cover = big ? "w-16 h-16" : "w-14 h-14";

  return (
    <div
      data-row={index}
      className={`flex items-center gap-3 pl-3 transition-colors ${
        active ? "bg-[rgba(var(--accent-rgb),0.12)]" : "hover:bg-bg-elevated"
      } ${busy ? "catalog-row-busy" : ""}`}
    >
      {/* Cover + ▶ preview. Its own button, NOT inside the pick button:
          previewing must never pick (and nested buttons are invalid). */}
      <span className={`relative ${cover} shrink-0`}>
        <span className="block w-full h-full rounded overflow-hidden bg-bg-elevated border border-border-subtle">
          {r.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.cover} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-xl">💿</span>
          )}
        </span>
        <span className="absolute -bottom-1 -right-1">
          <PreviewButton
            previewKey={resultKey(r)}
            src={{ source: r.source, id: r.id, title: r.title, artist: r.artist }}
            label={r.title}
          />
        </span>
      </span>

      {linkMode ? (
        r.source === "local" && r.slug ? (
          <Link href={`/releases/${r.slug}`} className={rowCls}>
            {body}
          </Link>
        ) : (
          // A plain <a>, never <Link>: Link PREFETCHES, and prefetching
          // this route would import the record without anyone tapping.
          <a
            href={`/catalog/open/${r.source}/${r.id}`}
            rel="nofollow"
            onClick={() => onSelect?.(r)}
            className={rowCls}
          >
            {body}
          </a>
        )
      ) : (
        <button
          type="button"
          onClick={() => onSelect?.(r)}
          disabled={disabled}
          className={rowCls}
        >
          {body}
        </button>
      )}
    </div>
  );
}

/** Release types → message keys (EP is upper-case in the data). */
function kindKey(kind: string): string {
  const k = kind.toLowerCase();
  return ["album", "ep", "single", "compilation", "mixtape"].includes(k) ? k : "album";
}

/* ==================================================================
   CatalogSearch — the picker (input + list), used by every create flow
   ================================================================== */

export default function CatalogSearch({
  onPick,
  placeholder,
  autoFocus = false,
  label,
}: CatalogSearchProps) {
  // LANGUAGES: messages → catalog. The API's own `notice` is shown as-is.
  const t = useTranslations("catalog");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [pasteHint, setPasteHint] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, artists, notice, error, searching, searchedFor } = useCatalogSearch(query);

  // The results list renders IN FLOW, right under the input — no
  // portal, no coordinate math. History (it matters): v1 was an
  // absolutely-positioned overlay (clipped by panel overflow), v2 a
  // position:fixed portal measured off getBoundingClientRect — which
  // iOS broke whenever the keyboard was up: WKWebView pans the page
  // natively (no DOM event fires, no rect changes), so the list drew
  // over the input itself until the keyboard closed (Luca
  // 2026-08-26: "it covers the entire search box"). In-flow content
  // is how /search already renders results, and it CANNOT misplace:
  // it pans with the page like everything else. The form below just
  // shifts down while the list is open (the keyboard covers it
  // anyway on phones), and auto-height panels grow to fit.

  // Fresh results → show them.
  useEffect(() => {
    if (searchedFor) setOpen(true);
  }, [searchedFor]);

  // Close on outside click/tap.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const handlePick = useCallback(
    async (r: CatalogResult) => {
      const key = resultKey(r);
      setImporting(key);
      setPickError(null);
      try {
        const res = await fetch("/api/catalog/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: r.source, id: r.id }),
        });
        const data = (await res.json()) as { release?: Release; error?: string };
        if (!res.ok || !data.release) {
          throw new Error(data.error ?? "import failed");
        }
        setOpen(false);
        setQuery("");
        onPick({ release: data.release, artist_name: r.artist });
      } catch (err) {
        setPickError(err instanceof Error ? err.message : t("couldntLoad"));
      } finally {
        setImporting(null);
      }
    },
    [onPick, t]
  );

  /** The paste-a-link door, one tap instead of a long-press. */
  async function pasteLink() {
    setPasteHint(null);
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (/spotify\.com\/|^spotify:/i.test(text)) {
        setQuery(text);
        inputRef.current?.focus();
        return;
      }
      setPasteHint(t("pasteNoLink"));
    } catch {
      // Clipboard blocked (permissions / older browsers): say how to
      // paste by hand instead.
      setPasteHint(t("pasteManual"));
      inputRef.current?.focus();
    }
  }

  const trimmed = query.trim();
  const shownError = pickError ?? error;
  const nothing =
    !!searchedFor && !searching && results.length === 0 && artists.length === 0 && !notice;

  return (
    <div ref={boxRef}>
      {label && (
        <label className="block text-xs uppercase tracking-widest text-text-muted mb-1.5 font-[family-name:var(--font-heading)]">
          {label}
        </label>
      )}

      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-muted pointer-events-none"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPickError(null);
            setPasteHint(null);
          }}
          onFocus={() => (results.length > 0 || artists.length > 0) && setOpen(true)}
          placeholder={placeholder ?? t("placeholder")}
          autoFocus={autoFocus}
          className="form-input !pl-10 pr-24"
          aria-label={t("aria")}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {searching && (
            <span className="osd-text text-xs animate-pulse">{t("tuning")}</span>
          )}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setOpen(false);
                inputRef.current?.focus();
              }}
              aria-label={t("clear")}
              className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
            >
              ✕
            </button>
          )}
        </span>
      </div>

      {/* Under the box, before typing: how to search + the link door. */}
      {!trimmed && (
        <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-text-muted">{t("tip")}</p>
          <button type="button" onClick={pasteLink} className="paste-link-btn">
            <span aria-hidden>⧉</span> {t("pasteLink")}
          </button>
        </div>
      )}
      {pasteHint && <p className="mt-1.5 text-xs text-osd-amber">{pasteHint}</p>}

      {shownError && <p className="mt-1.5 text-xs text-accent-rose">{shownError}</p>}
      {!shownError && notice && <p className="mt-1.5 text-xs text-osd-amber">{notice}</p>}

      {/* First search in flight: skeleton rows, not a blank gap. */}
      {searching && !searchedFor && trimmed.length >= 2 && (
        <div className="mt-2 rounded-lg border border-border-medium bg-[#0c0c0f] overflow-hidden">
          <SkeletonRows n={3} />
        </div>
      )}

      {open && (results.length > 0 || artists.length > 0) && (
        <div className={`mt-2 transition-opacity ${searching ? "opacity-70" : ""}`}>
          <CatalogResultList
            results={results}
            artists={artists}
            query={searchedFor}
            onSelect={handlePick}
            busyKey={importing}
            inputRef={inputRef}
            onEscape={() => setOpen(false)}
            scroll
          />
        </div>
      )}

      {/* Nothing anywhere — say what to try next, with the link door. */}
      {nothing && (
        <div className="mt-2 rounded-lg border border-border-medium bg-[#0c0c0f] p-4 space-y-2 text-center">
          <p className="osd-text text-sm">{t("noSignal")}</p>
          <p className="text-sm text-text-secondary">{t("nothing", { query: searchedFor })}</p>
          <button type="button" onClick={pasteLink} className="paste-link-btn mx-auto">
            <span aria-hidden>⧉</span> {t("pasteLink")}
          </button>
        </div>
      )}

      {/* Results but maybe not THE one: the hidden-album tip, quietly. */}
      {open && results.length > 0 && !searching && (
        <p className="mt-2 text-[11px] text-text-muted leading-relaxed">
          {t.rich("missingTip", {
            b: (chunks) => (
              <button type="button" onClick={pasteLink} className="text-accent-primary hover:underline">
                {chunks}
              </button>
            ),
          })}
        </p>
      )}
    </div>
  );
}
