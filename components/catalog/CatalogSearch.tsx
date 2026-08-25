"use client";

/**
 * CatalogSearch — the one way anything enters the platform.
 *
 * Type → unified results from the local catalog, Spotify albums,
 * and Genius songs (deep catalog incl. unreleased) → pick one →
 * the release is imported on demand and the full local row is
 * handed to `onPick`. No manual title/artist/cover fields exist
 * anywhere anymore.
 *
 * Replaces the old SpotifyAutocomplete (which only searched rows
 * an admin had pre-imported).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Release } from "@/lib/types/database";

interface CatalogResult {
  source: "local" | "spotify" | "spotify_track" | "genius";
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  year: string | null;
  kind: string;
  slug?: string;
  unreleased?: boolean;
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

const SOURCE_BADGE: Record<CatalogResult["source"], { text: string; cls: string }> = {
  local: { text: "ON PMR", cls: "text-accent-glow border-accent-primary/40" },
  // Spotify stays brand-green (Luca 2026-08-25) — the sitewide
  // green→blue recolor deliberately skips this one badge.
  spotify: { text: "SPOTIFY", cls: "text-osd-green border-osd-green/40" },
  spotify_track: { text: "SPOTIFY", cls: "text-osd-green border-osd-green/40" },
  genius: { text: "GENIUS", cls: "text-osd-amber border-osd-amber/40" },
};

export default function CatalogSearch({
  onPick,
  placeholder = "Search any album, song, or artist…",
  autoFocus = false,
  label,
}: CatalogSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef("");

  // Where the portal dropdown should sit, in viewport coordinates.
  // The results list renders into document.body (createPortal below),
  // so NO ancestor can clip it (panel overflow:hidden) or paint over
  // it (later siblings sharing a stacking context) — the fix is
  // structural and applies to every form that uses this component.
  const [anchor, setAnchor] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const measure = useCallback(() => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({
      left: r.left,
      top: r.bottom + 8,
      width: r.width,
      // Never taller than the space under the input (12px breathing
      // room) — the list scrolls internally instead of running off
      // the bottom of the viewport.
      maxHeight: Math.max(160, window.innerHeight - r.bottom - 20),
    });
  }, []);

  // Keep the dropdown glued to the input while open: page scroll
  // (capture — the scroller may be any ancestor), resizes, and the
  // mobile keyboard showing/hiding all move the anchor.
  useEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  // Close on outside click — the portal list lives outside boxRef in
  // the DOM, so clicks inside it must count as inside.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (
        boxRef.current &&
        !boxRef.current.contains(t) &&
        !(listRef.current && listRef.current.contains(t))
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    lastQueryRef.current = q;
    if (q.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/search/catalog?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("search failed");
      const data = (await res.json()) as { results: CatalogResult[] };
      // A slower response for an older query must never clobber results.
      if (lastQueryRef.current === q) {
        setResults(data.results);
        setOpen(true);
      }
    } catch {
      if (lastQueryRef.current === q) setError("Search hiccuped — try again.");
    } finally {
      if (lastQueryRef.current === q) setSearching(false);
    }
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 300);
  }

  async function handlePick(r: CatalogResult) {
    const key = `${r.source}:${r.id}`;
    setImporting(key);
    setError(null);
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
      setResults([]);
      onPick({ release: data.release, artist_name: r.artist });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't load that release."
      );
    } finally {
      setImporting(null);
    }
  }

  return (
    // The results list itself renders through a portal (bottom of this
    // file), so this wrapper needs no z-index games — it's just the
    // measuring anchor for where the list should appear.
    <div ref={boxRef} className="relative">
      {label && (
        <label className="block text-xs uppercase tracking-widest text-text-muted mb-1.5 font-[family-name:var(--font-heading)]">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="form-input pr-20"
          aria-label="Search the music catalog"
        />
        {searching && (
          <span className="osd-text absolute right-3 top-1/2 -translate-y-1/2 text-xs animate-pulse">
            TUNING…
          </span>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-accent-rose">{error}</p>}

      {/* Portal dropdown: fixed-position at the measured anchor, top
          z-index — nothing on any page can cover or clip it. */}
      {open && results.length > 0 && anchor &&
        createPortal(
        <div
          ref={listRef}
          style={{
            position: "fixed",
            left: anchor.left,
            top: anchor.top,
            width: anchor.width,
            maxHeight: anchor.maxHeight,
            zIndex: 100,
          }}
          className="overflow-y-auto rounded-lg border border-border-medium bg-[#0c0c0f] shadow-[0_16px_50px_rgba(0,0,0,0.8)]"
        >
          {results.map((r) => {
            const key = `${r.source}:${r.id}`;
            const badge = SOURCE_BADGE[r.source];
            return (
              <button
                key={key}
                type="button"
                onClick={() => handlePick(r)}
                disabled={importing !== null}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-bg-elevated transition-colors disabled:opacity-60"
              >
                {/* Cover thumb */}
                <span className="w-14 h-14 rounded overflow-hidden bg-bg-elevated shrink-0 border border-border-subtle">
                  {r.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-xl">
                      💿
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold text-text-primary truncate">
                    {r.title}
                  </span>
                  <span className="block text-sm text-text-secondary truncate">
                    {r.artist}
                    {r.year ? ` · ${r.year}` : ""}
                    {r.kind ? ` · ${r.kind}` : ""}
                  </span>
                </span>

                {r.unreleased && (
                  <span className="pixel-text text-[10px] text-osd-amber border border-osd-amber/40 rounded px-1 py-0.5 shrink-0">
                    UNRELEASED
                  </span>
                )}

                <span
                  className={`pixel-text text-[10px] border rounded px-1 py-0.5 shrink-0 ${badge.cls}`}
                >
                  {importing === key ? "LOADING…" : badge.text}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
