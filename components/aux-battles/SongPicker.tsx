"use client";

/**
 * SongPicker — how a player puts a song on. Three source tabs
 * (Spotify / SoundCloud / YouTube), a search box, and a paste-a-link
 * box that always works — search needs the service's key on the
 * server (/api/aux-battles/songs says which are on; the tab then
 * shows "paste a link" instead of a dead search).
 *
 * Results render IN FLOW under the input (the iOS keyboard lesson
 * from CatalogSearch — no portals, no fixed overlays). Picking a
 * result shows the card with a PUT IT ON confirm, so a fat thumb
 * never locks the wrong song in.
 */

import { useCallback, useEffect, useRef, useState } from "react";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { hapticTap } from "@/lib/native";
import type { AuxSong } from "@/lib/types/database";
import { sourceTag } from "@/components/aux-battles/SongEmbed";

type Source = AuxSong["source"];
const SOURCES: Source[] = ["spotify", "soundcloud", "youtube"];

interface Props {
  onPick: (song: AuxSong) => Promise<void>;
  /** The side's colour. */
  tone: "a" | "b";
}

export default function SongPicker({ onPick, tone }: Props) {
  const t = useTranslations("aux.picker");
  const [source, setSource] = useState<Source>("spotify");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuxSong[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchable, setSearchable] = useState<Record<Source, boolean> | null>(null);
  const [link, setLink] = useState("");
  const [reading, setReading] = useState(false);
  const [chosen, setChosen] = useState<AuxSong | null>(null);
  const [putting, setPutting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef("");

  const accent = tone === "a" ? "text-accent-primary border-accent-primary/40" : "text-accent-rose border-accent-rose/40";

  // Ask once which sources can search (a 2-letter probe is enough).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/aux-battles/songs?q=&source=spotify`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { searchable?: Record<Source, boolean> } | null) => {
        if (!cancelled && d?.searchable) setSearchable(d.searchable);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const canSearch = searchable ? searchable[source] : true;

  const runSearch = useCallback(
    async (q: string, src: Source) => {
      lastQueryRef.current = q;
      if (q.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/aux-battles/songs?q=${encodeURIComponent(q)}&source=${src}`
        );
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as {
          results: AuxSong[];
          searchable?: Record<Source, boolean>;
        };
        if (lastQueryRef.current === q) {
          setResults(data.results);
          if (data.searchable) setSearchable(data.searchable);
        }
      } catch {
        if (lastQueryRef.current === q) setError(t("hiccup"));
      } finally {
        if (lastQueryRef.current === q) setSearching(false);
      }
    },
    [t]
  );

  function handleQuery(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(value, source), 350);
  }

  function switchSource(s: Source) {
    hapticTap();
    setSource(s);
    setResults([]);
    setChosen(null);
    setError(null);
    if (query.trim().length >= 2) void runSearch(query, s);
  }

  async function readLink() {
    const url = link.trim();
    if (!url || reading) return;
    setReading(true);
    setError(null);
    try {
      const res = await fetch("/api/aux-battles/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { song?: AuxSong; error?: string };
      if (!res.ok || !data.song) throw new Error(data.error ?? t("badLink"));
      setChosen(data.song);
      setSource(data.song.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("badLink"));
    } finally {
      setReading(false);
    }
  }

  async function confirm() {
    if (!chosen || putting) return;
    hapticTap();
    setPutting(true);
    setError(null);
    try {
      await onPick(chosen);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("hiccup"));
      setPutting(false);
    }
  }

  const tab = (s: Source) => {
    const active = source === s;
    return (
      <button
        key={s}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => switchSource(s)}
        className={`flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide uppercase whitespace-nowrap transition-all font-[family-name:var(--font-heading)] ${
          active
            ? "bg-accent-primary/15 text-accent-primary border border-accent-primary/30"
            : "text-text-secondary border border-transparent hover:text-text-primary"
        }`}
      >
        {t(`sources.${s}`)}
      </button>
    );
  };

  /* The chosen card + confirm */
  if (chosen) {
    const tag = sourceTag(chosen.source);
    return (
      <div className="space-y-3">
        <div className="panel-xbox p-3 flex items-center gap-3">
          <span className="w-14 h-14 rounded overflow-hidden border border-border-subtle shrink-0 bg-bg-elevated flex items-center justify-center">
            {chosen.artwork ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={chosen.artwork} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl">🎵</span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold truncate">{chosen.title}</span>
            {chosen.artist && (
              <span className="block text-xs text-text-secondary truncate">{chosen.artist}</span>
            )}
            <span className={`inline-block mt-1 pixel-text text-[9px] uppercase px-1 rounded border ${tag.cls}`}>
              {tag.text}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setChosen(null)}
            disabled={putting}
            className="text-xs text-accent-rose hover:underline shrink-0"
          >
            {t("change")}
          </button>
        </div>
        {error && <p className="text-xs text-accent-rose">{error}</p>}
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={putting}
          className="btn-y2k btn-y2k-primary w-full disabled:opacity-50"
        >
          {putting ? t("putting") : t("putOn")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div role="tablist" className="flex w-full rounded-full border border-border-medium bg-bg-elevated p-1 gap-1">
        {SOURCES.map(tab)}
      </div>

      {canSearch ? (
        <div>
          <input
            type="search"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            placeholder={t("placeholder", { source: t(`sources.${source}`) })}
            className="form-input"
            autoComplete="off"
          />
          {searching && (
            <p className="mt-1 pixel-text text-[10px] uppercase tracking-widest text-text-muted">
              {t("searching")}
            </p>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-1 text-xs text-text-muted">{t("noResults")}</p>
          )}
          {results.length > 0 && (
            /* The chrome and the SCROLLER have to be two elements.
               .panel-xbox carries `overflow: hidden`, and globals.css
               is loaded after Tailwind's utilities, so putting both on
               one <ul> let that beat `overflow-y-auto` — the list was
               capped AND clipped, five rows with no way down (Luca
               2026-09-14: "its still a stuck select 5"). The panel is
               the wrapper now; the <ul> inside does the scrolling.

               PHONES still get no inner scroller: the results sit in
               the page flow and the PAGE scrolls them. A short window
               inside a page that also scrolls is a thumb-trap on iOS,
               where the drag fights over which box moves. Desktop gets
               the capped window a mouse wheel expects, and
               overscroll-contain keeps the wheel from leaking to the
               page at the ends. */
            <div className="mt-2 panel-xbox">
              <ul className="divide-y divide-border-subtle sm:max-h-[26rem] sm:overflow-y-auto sm:overscroll-contain">
              {results.map((s) => {
                const tag = sourceTag(s.source);
                return (
                  <li key={`${s.source}:${s.embed_id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        hapticTap();
                        setChosen(s);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-bg-elevated transition-colors"
                    >
                      <span className="w-10 h-10 rounded overflow-hidden border border-border-subtle shrink-0 bg-bg-elevated flex items-center justify-center">
                        {s.artwork ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.artwork} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>🎵</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold truncate">{s.title}</span>
                        {s.artist && (
                          <span className="block text-xs text-text-secondary truncate">{s.artist}</span>
                        )}
                      </span>
                      <span className={`pixel-text text-[9px] uppercase px-1 rounded border shrink-0 ${tag.cls}`}>
                        {tag.text}
                      </span>
                    </button>
                  </li>
                );
              })}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className={`text-xs rounded-lg border px-3 py-2 ${accent}`}>{t("linkOnly", { source: t(`sources.${source}`) })}</p>
      )}

      {/* Paste a link — always there, for every source */}
      <div className="flex gap-2">
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void readLink();
            }
          }}
          placeholder={t("pastePlaceholder")}
          className="form-input flex-1 min-w-0"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => void readLink()}
          disabled={!link.trim() || reading}
          className="btn-y2k btn-y2k-outline !px-3 !text-xs shrink-0 disabled:opacity-40"
        >
          {reading ? "…" : t("paste")}
        </button>
      </div>
      {error && <p className="text-xs text-accent-rose">{error}</p>}
    </div>
  );
}
