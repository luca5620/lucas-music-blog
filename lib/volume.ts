/**
 * The site-wide preview VOLUME (Luca 2026-09-13: "a volume slider
 * somewhere on the website to control the volume of songs played
 * through the previews and for aux battles").
 *
 * WHAT CAN AND CANNOT BE CONTROLLED — the honest picture:
 *   SoundCloud  ✓ its Widget API has setVolume()
 *   YouTube     ✓ its IFrame API has setVolume() (needs enablejsapi=1)
 *   Spotify     ✗ the Spotify embed API exposes play/pause/seek and
 *                 NOTHING for volume — the listener sets it in the
 *                 player itself or with their system volume
 *   Apple Music ✗ same story, no public volume control on the embed
 * A page cannot reach into a cross-origin iframe and turn it down; we
 * only get what each service chose to expose. So the slider renders
 * ONLY where at least one player on screen can actually answer it,
 * and says so when a Spotify/Apple player is sharing the stage.
 *
 * One level for the whole site, remembered per device in
 * localStorage. Every mounted player subscribes, so dragging the
 * slider in an aux battle also sets the release-page preview later.
 */

const KEY = "pmr-preview-volume";
const DEFAULT = 80;

/** Sources whose players actually respond to a volume command. */
export type ControllableSource = "soundcloud" | "youtube";

export function isControllable(source: string | null | undefined): source is ControllableSource {
  return source === "soundcloud" || source === "youtube";
}

let current: number | null = null;
const listeners = new Set<(v: number) => void>();

function clamp(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** The level right now (0–100). Reads localStorage once, then memory. */
export function getVolume(): number {
  if (current !== null) return current;
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    current = raw === null ? DEFAULT : clamp(Number(raw));
  } catch {
    // Private windows and blocked site data throw — the default is fine.
    current = DEFAULT;
  }
  return current;
}

/** Set the level and tell every mounted player. */
export function setVolume(value: number): void {
  const v = clamp(value);
  current = v;
  try {
    window.localStorage.setItem(KEY, String(v));
  } catch {
    // Not being able to remember it is not a reason to not apply it.
  }
  for (const fn of listeners) fn(v);
}

/** Subscribe to changes; returns the unsubscribe. */
export function subscribeVolume(fn: (v: number) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
