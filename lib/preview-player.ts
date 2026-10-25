"use client";

/**
 * The one preview player — CLIENT ONLY (2026-10-22).
 *
 * Every ▶ on the site (search results, the record you just picked in
 * the review form, its tracklist) goes through here, so exactly ONE
 * 30-second preview plays at a time: starting another stops the first,
 * like a real jukebox. One shared <audio> element, created on first
 * use; React components read the state through `usePreview()`.
 *
 * Where the audio comes from: /api/preview (see lib/spotify/preview.ts).
 * The answer per record is cached here for the session, so pressing ▶
 * twice, or opening the tracklist after previewing the album, costs
 * nothing.
 *
 * LEAVING THE PAGE STOPS IT (bug fix 2026-10-25, Luca: press ▶ on a
 * song-by-song row, go to another page, the song kept playing).
 * Why it happened: the <audio> element lives in THIS module, not in
 * any component — it's created with `new Audio()` and never put on
 * the page. Client-side navigation (a Link tap, the back button)
 * unmounts the review page's components, but a module-level object
 * doesn't belong to any of them, so nothing ever told it to pause.
 * The fix is `PreviewRouteStop` at the bottom: mounted once in the
 * root layout (which never unmounts), it watches the URL path and
 * stops the player whenever it changes. Plus a `pagehide` listener
 * for real page unloads / the app being backgrounded mid-navigation.
 */

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

export interface PreviewSource {
  /** Same values as CatalogResult.source. */
  source: "local" | "spotify" | "spotify_track" | "genius";
  id: string;
  /** Genius only: matched by name on the server. */
  title?: string;
  artist?: string;
}

export interface PreviewTrack {
  title: string;
  spotify_id: string | null;
  url: string | null;
}

export type PreviewStatus = "idle" | "loading" | "playing" | "none";

interface State {
  /** Which button is active — `${source}:${id}` or `…#${track id}`. */
  key: string | null;
  status: PreviewStatus;
  /** Title of the track that is playing (an album plays its first). */
  trackTitle: string | null;
  /** 0–1 through the 30 seconds, for the little progress ring. */
  progress: number;
}

let state: State = { key: null, status: "idle", trackTitle: null, progress: 0 };
const listeners = new Set<() => void>();
const cache = new Map<string, Promise<PreviewTrack[]>>();
let audio: HTMLAudioElement | null = null;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function getAudio(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "none";
  audio.addEventListener("ended", () => set({ key: null, status: "idle", progress: 0 }));
  audio.addEventListener("timeupdate", () => {
    if (!audio || !audio.duration) return;
    set({ progress: Math.min(1, audio.currentTime / audio.duration) });
  });
  // A real page unload (full reload, leaving the site, iOS putting the
  // page in the back/forward cache) — stop, so nothing resumes later.
  window.addEventListener("pagehide", stopPreview);
  return audio;
}

/** Fetch (once per session) every preview for a record. */
export function loadPreviews(src: PreviewSource): Promise<PreviewTrack[]> {
  const cacheKey = `${src.source}:${src.id}`;
  let p = cache.get(cacheKey);
  if (!p) {
    const qs = new URLSearchParams({ source: src.source, id: src.id });
    if (src.source === "genius") {
      qs.set("title", src.title ?? "");
      qs.set("artist", src.artist ?? "");
    }
    p = fetch(`/api/preview?${qs}`)
      .then((r) => (r.ok ? r.json() : { tracks: [] }))
      .then((d: { tracks?: PreviewTrack[] }) => d.tracks ?? [])
      .catch(() => {
        cache.delete(cacheKey); // a network blip may retry later
        return [];
      });
    cache.set(cacheKey, p);
  }
  return p;
}

/** Stop whatever is playing. */
export function stopPreview() {
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  if (state.key) set({ key: null, status: "idle", trackTitle: null, progress: 0 });
}

/**
 * Toggle the preview for a record (or one track of it).
 *   key      — the button's identity (pressing the playing one stops it)
 *   pick     — which track to play from the record's list; default =
 *              the first one that HAS a preview
 */
export async function togglePreview(
  key: string,
  src: PreviewSource,
  pick?: (tracks: PreviewTrack[]) => PreviewTrack | undefined
) {
  if (state.key === key && (state.status === "playing" || state.status === "loading")) {
    stopPreview();
    return;
  }
  stopPreview();
  set({ key, status: "loading", trackTitle: null, progress: 0 });

  const tracks = await loadPreviews(src);
  // Another button was pressed while we were fetching — let it win.
  if (state.key !== key) return;

  const track = pick ? pick(tracks) : tracks.find((t) => t.url);
  if (!track?.url) {
    set({ status: "none" });
    // "No preview" shows briefly, then the button resets.
    setTimeout(() => {
      if (state.key === key && state.status === "none") set({ key: null, status: "idle" });
    }, 1800);
    return;
  }

  const el = getAudio();
  el.src = track.url;
  el.volume = 0.8;
  try {
    await el.play();
    if (state.key === key) set({ status: "playing", trackTitle: track.title });
  } catch {
    // Autoplay refusal or a dead link — treat as "no preview".
    if (state.key === key) set({ key: null, status: "idle" });
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const SERVER_STATE: State = { key: null, status: "idle", trackTitle: null, progress: 0 };

/** Live player state. Compare `key` to your button's key. */
export function usePreview(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE
  );
}

/**
 * Stops the preview on every page change. Renders nothing; mounted
 * ONCE in app/layout.tsx (the root layout stays mounted across every
 * client-side navigation, so this effect sees every path change —
 * Link taps, router.push, and the browser/app back button alike).
 *
 * Path only, not the query string: re-filtering /search (?q=…) is the
 * same page, and a preview you started there should keep playing.
 */
export function PreviewRouteStop(): null {
  const pathname = usePathname();
  useEffect(() => {
    // Runs after the new page commits. Also runs once on first load,
    // when nothing is playing yet — stopPreview is a no-op then.
    stopPreview();
  }, [pathname]);
  return null;
}
