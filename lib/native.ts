/**
 * Native-bridge helpers for the Capacitor apps (iOS/Android).
 *
 * The mobile apps are a native shell whose WebView loads the live
 * site; Capacitor injects a `window.Capacitor` bridge into the page
 * when (and only when) it's running inside the app. On the plain web
 * these helpers all no-op, so components can call them freely.
 *
 * Why bother? Apple rejects apps that are "just a website" (guideline
 * 4.2 minimum functionality). Haptics, the native share sheet, and
 * app-y touches like these are part of what makes the shell feel —
 * and review — like a real app.
 */

interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    Haptics?: { impact: (opts: { style: string }) => Promise<void> };
    Share?: {
      share: (opts: {
        title?: string;
        text?: string;
        url?: string;
      }) => Promise<unknown>;
    };
  };
}

function bridge(): CapacitorBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor ?? null;
}

/** True when running inside the iOS/Android app shell. */
export function isNativeApp(): boolean {
  return bridge()?.isNativePlatform?.() ?? false;
}

/** "ios" | "android" | "web" */
export function nativePlatform(): string {
  return bridge()?.getPlatform?.() ?? "web";
}

/** Small physical tap — use on rating changes, votes, reactions. */
export async function hapticTap(): Promise<void> {
  try {
    await bridge()?.Plugins?.Haptics?.impact({ style: "LIGHT" });
  } catch {
    /* haptics are garnish — never break the flow */
  }
}

/**
 * Haptic with a chosen weight — the two-word vocabulary the fullscreen
 * channel surfaces use: LIGHT for ambient ticks (a snap settling),
 * MEDIUM for deliberate acts (like/follow/track, crossing the
 * drag-to-exit threshold, entering/leaving fullscreen). Same
 * fire-and-forget optional-bridge pattern as hapticTap: on the plain
 * web there is no bridge and this silently no-ops.
 */
export async function hapticImpact(style: "LIGHT" | "MEDIUM"): Promise<void> {
  try {
    await bridge()?.Plugins?.Haptics?.impact({ style });
  } catch {
    /* haptics are garnish — never break the flow */
  }
}

/**
 * Share via the native sheet when in-app; falls back to the Web
 * Share API, then to copying the URL to the clipboard.
 */
export async function shareLink(title: string, url: string): Promise<void> {
  const native = bridge()?.Plugins?.Share;
  try {
    if (native) {
      await native.share({ title, url });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  } catch {
    /* user cancelled the sheet — fine */
  }
}
