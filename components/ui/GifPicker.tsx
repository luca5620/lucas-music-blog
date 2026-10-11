"use client";

/**
 * GifPicker — search KLIPY and pick a GIF (2026-10-11).
 *
 * Used by the review form and the comment boxes. It opens IN FLOW,
 * right under the button that opened it, never as a fixed popup: the
 * search box raises the iOS keyboard, and fixed/anchored popups drift
 * when WKWebView pans for the keyboard (see the "iOS keyboard: no
 * fixed portals" lesson — CatalogSearch works the same way).
 *
 * The browser talks to KLIPY directly (their terms forbid proxying it
 * through our server) — see lib/gif.ts for the full list of rules
 * this follows: results in KLIPY's order, "Search KLIPY" in the box,
 * "Powered by KLIPY" on the panel, media URLs used exactly as given.
 *
 * Empty box = KLIPY's trending GIFs. Typing searches (debounced so a
 * word doesn't fire one request per letter — the testing key allows
 * only 100 requests an hour).
 */

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  GIF_CONTENT_FILTER,
  KLIPY_API,
  KLIPY_APP_KEY,
  type Gif,
} from "@/lib/gif";

/** One size of one format in a KLIPY result: file.md.webp etc. */
interface KlipyFile {
  url?: string;
  width?: number;
  height?: number;
}

/** The parts of a KLIPY GIF result we use. */
interface KlipyItem {
  id?: number | string;
  slug?: string;
  title?: string;
  type?: string;
  file?: Record<string, Record<string, KlipyFile> | undefined>;
}

/** A result ready to show: the small preview for the grid and the
 *  medium version that actually gets attached. */
interface Result {
  key: string;
  slug: string;
  title: string;
  preview: KlipyFile;
  pick: Gif;
}

/**
 * KLIPY wants a country code; our six languages map to the country
 * where most of their speakers on the site are. Only nudges which
 * GIFs trend — search works the same everywhere.
 */
const LOCALE_TO_COUNTRY: Record<string, string> = {
  en: "us",
  es: "es",
  fr: "fr",
  pt: "br",
  nl: "nl",
  de: "de",
};

/**
 * KLIPY asks for a per-person id (it powers their "recent" lists and
 * abuse limits). We give it a random id that lives on this device
 * only — never the account id — so KLIPY can't tie GIF searches to a
 * Peak Music profile.
 */
function customerId(): string {
  const KEY = "pmr:gif-cid";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Private mode etc. — a per-visit id is still a valid answer.
    return "anon";
  }
}

/** First size/format that exists, in our order of preference. WebP
 *  first — animated WebP is a fraction of the GIF's weight and every
 *  browser and iOS version we support plays it. */
function bestFile(item: KlipyItem, sizes: string[]): KlipyFile | null {
  for (const size of sizes) {
    const formats = item.file?.[size];
    if (!formats) continue;
    for (const format of ["webp", "gif"]) {
      const f = formats[format];
      if (f?.url && f.width && f.height) return f;
    }
  }
  return null;
}

function toResult(item: KlipyItem): Result | null {
  // Only GIF objects. (If KLIPY ads were ever switched on in the
  // Partner Panel, "ad" objects would ride along — we don't render
  // those, and ads stay off.)
  if (item.type && item.type !== "gif") return null;
  const preview = bestFile(item, ["sm", "xs", "md"]);
  const pick = bestFile(item, ["md", "sm", "hd"]);
  if (!preview || !pick) return null;
  return {
    key: String(item.id ?? item.slug ?? pick.url),
    slug: item.slug ?? "",
    title: item.title ?? "",
    preview,
    pick: { url: pick.url!, width: pick.width!, height: pick.height! },
  };
}

export default function GifPicker({
  onPick,
  onClose,
}: {
  onPick: (gif: Gif) => void;
  onClose: () => void;
}) {
  const t = useTranslations("gifs");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The last request wins — a slow "c" answer must never overwrite
  // the "cat" results that came back first.
  const requestId = useRef(0);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  async function load(q: string, pageNo: number) {
    const id = ++requestId.current;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({
      page: String(pageNo),
      per_page: "24",
      customer_id: customerId(),
      locale: LOCALE_TO_COUNTRY[locale] ?? "us",
      content_filter: GIF_CONTENT_FILTER,
    });
    if (q) params.set("q", q);
    const endpoint = q ? "search" : "trending";
    try {
      const res = await fetch(
        `${KLIPY_API}/${encodeURIComponent(KLIPY_APP_KEY)}/gifs/${endpoint}?${params}`
      );
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as {
        data?: { data?: KlipyItem[]; has_next?: boolean };
      };
      if (id !== requestId.current) return;
      const items = (json.data?.data ?? [])
        .map(toResult)
        .filter((r): r is Result => r !== null);
      setResults((prev) => (pageNo === 1 ? items : [...prev, ...items]));
      setHasNext(Boolean(json.data?.has_next));
      setPage(pageNo);
    } catch {
      if (id !== requestId.current) return;
      setFailed(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  // Trending on open, search as you type (350ms after the last key).
  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(() => load(q, 1), q ? 350 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function pick(result: Result) {
    // Tell KLIPY which GIF was shared — it's how their search learns
    // what's good. Best-effort: a failure here must never block the
    // pick, so nothing is awaited.
    if (result.slug) {
      void fetch(
        `${KLIPY_API}/${encodeURIComponent(KLIPY_APP_KEY)}/gifs/share/${encodeURIComponent(result.slug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_id: customerId(), q: query.trim() }),
        }
      ).catch(() => {});
    }
    onPick(result.pick);
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-elevated/60 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // KLIPY requires this exact placeholder — not translated.
          placeholder="Search KLIPY"
          aria-label="Search KLIPY"
          className="form-input flex-1 !py-2 text-sm"
          enterKeyHint="search"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="w-9 h-9 shrink-0 rounded-full border border-border-subtle text-text-muted hover:text-text-primary hover:border-border-medium transition-colors"
        >
          ✕
        </button>
      </div>

      <p className="label-xbox text-[0.6rem]">
        {query.trim() ? t("results") : t("trending")}
      </p>

      {/* The grid scrolls inside its own box so a page of GIFs never
          shoves the rest of the form (or the comment thread) away. */}
      <div className="max-h-72 overflow-y-auto overscroll-contain pr-1">
        {failed && results.length === 0 ? (
          <p className="text-xs text-text-muted py-6 text-center">{t("failed")}</p>
        ) : !loading && results.length === 0 ? (
          <p className="text-xs text-text-muted py-6 text-center">{t("none")}</p>
        ) : (
          <div className="columns-2 sm:columns-3 gap-2 [&>*]:mb-2">
            {results.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => pick(r)}
                title={r.title}
                className="block w-full rounded-md overflow-hidden border border-transparent hover:border-accent-primary/60 focus-visible:border-accent-primary transition-colors bg-black/30 break-inside-avoid"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.preview.url}
                  alt={r.title}
                  width={r.preview.width}
                  height={r.preview.height}
                  loading="lazy"
                  className="w-full h-auto block"
                />
              </button>
            ))}
          </div>
        )}
        {loading && (
          <p className="pixel-text text-xs text-text-muted py-3 text-center">…</p>
        )}
        {!loading && hasNext && results.length > 0 && (
          <button
            type="button"
            onClick={() => load(query.trim(), page + 1)}
            className="w-full py-2 label-xbox text-[0.6rem] hover:text-accent-primary transition-colors"
          >
            {t("more")}
          </button>
        )}
      </div>

      {/* KLIPY's required attribution — not translated (brand mark). */}
      <p className="text-[10px] text-text-muted text-right tracking-wide">
        Powered by KLIPY
      </p>
    </div>
  );
}
