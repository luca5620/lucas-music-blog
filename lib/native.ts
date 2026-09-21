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

/** The push plugin's permission answer: "granted" | "denied" | "prompt". */
interface PushPermissionStatus {
  receive: string;
}

/** What every Capacitor addListener() resolves to — call remove() on unmount. */
export interface PluginListener {
  remove: () => Promise<void>;
}

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
    PushNotifications?: {
      checkPermissions: () => Promise<PushPermissionStatus>;
      requestPermissions: () => Promise<PushPermissionStatus>;
      register: () => Promise<void>;
      addListener: (
        event: string,
        callback: (data: never) => void
      ) => Promise<unknown>;
      removeAllListeners: () => Promise<void>;
    };
    Browser?: {
      open: (opts: {
        url: string;
        presentationStyle?: "fullscreen" | "popover";
      }) => Promise<void>;
      close: () => Promise<void>;
      addListener: (
        event: string,
        callback: () => void
      ) => Promise<PluginListener>;
    };
    SplashScreen?: { hide: (opts?: { fadeOutDuration?: number }) => Promise<void> };
    App?: {
      /** Bundle version + build number from the installed binary. */
      getInfo?: () => Promise<{ version: string; build: string }>;
      addListener: (
        event: string,
        callback: (data: { url: string }) => void
      ) => Promise<PluginListener>;
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

/**
 * Drop Capacitor's static launch image.
 *
 * From build 3 (2026-09-21) capacitor.config.ts has launchAutoHide
 * OFF: the native still stays up until the web layer says so, which
 * is what lets SplashCurtain hand off from it with no gap and no
 * double. The price is that the web layer now OWNS dismissal — every
 * path that decides not to play the curtain must call this instead,
 * and NATIVE_SPLASH_FAILSAFE_SCRIPT below backs all of them up. On
 * older builds (auto-hide on) this is a harmless no-op: the still is
 * already gone by the time anything here runs.
 */
export async function hideNativeSplash(): Promise<void> {
  try {
    await bridge()?.Plugins?.SplashScreen?.hide({ fadeOutDuration: 120 });
  } catch {
    /* no plugin, or already hidden — either way the app is up */
  }
}

/**
 * The installed binary's build number, or null on the web and on any
 * shell too old to carry the token. SplashCurtain gates the handoff on
 * this, because whether the native still auto-hides is baked into the
 * binary and the web has no other way to know.
 *
 * Read from the USER AGENT — capacitor.config.ts appends
 * `PMRBuild/<n>` on iOS from build 3. The first version asked the App
 * plugin's getInfo() instead, and that was replaced for a reason that
 * turned out to be different from the one first suspected: the plugin
 * IS registered and does answer (verified on a build-3 simulator with
 * a page that printed the bridge state). What actually broke the
 * curtain was a hydration remount racing an awaited call — see
 * SplashCurtain. The UA is still the better source: set by the shell
 * before any page script runs, no plugin, no promise, nothing for a
 * remount to interrupt, and visible in server logs too.
 */
export function appBuildNumber(): number | null {
  if (typeof navigator === "undefined") return null;
  const m = /\bPMRBuild\/(\d+)\b/.exec(navigator.userAgent);
  return m ? Number(m[1]) : null;
}

/**
 * Inline <head> failsafe, rendered by app/layout.tsx before anything
 * else loads. If React never mounts — a crash in a chunk, a script
 * that hangs, anything — nothing would ever call hideNativeSplash()
 * and a phone would sit on the launch image forever. This drops it
 * after 5s regardless, which is long enough that a normal boot has
 * long since handed off cleanly and never sees it fire. Only acts in
 * the shell; on the web `window.Capacitor` doesn't exist.
 */
export const NATIVE_SPLASH_FAILSAFE_SCRIPT =
  "setTimeout(function(){try{var c=window.Capacitor;if(c&&c.isNativePlatform&&c.isNativePlatform()&&c.Plugins&&c.Plugins.SplashScreen){c.Plugins.SplashScreen.hide()}}catch(e){}},5000)";

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
 * The push plugin off the injected bridge — null on the plain web and
 * on app builds that predate the plugin (older installed versions of
 * the shell keep working; they just never register for push).
 */
export function pushPlugin() {
  return bridge()?.Plugins?.PushNotifications ?? null;
}

/**
 * The Browser plugin (@capacitor/browser) off the injected bridge —
 * opens a URL in SFSafariViewController / a Custom Tab instead of in
 * the app's own WebView.
 *
 * Null on the plain web AND on app builds that predate the plugin,
 * which here is load-bearing rather than incidental: the shell loads
 * the LIVE site, so every web deploy reaches phones still running the
 * OLD binary. Social sign-in in the app is gated on this being
 * non-null, so 1.0 installs keep showing email/password only instead
 * of sprouting buttons that would open nothing. The 1.1 build arms
 * itself the moment it's installed.
 */
export function browserPlugin() {
  return bridge()?.Plugins?.Browser ?? null;
}

/**
 * The App plugin (@capacitor/app) — used here for `appUrlOpen`, which
 * fires when iOS/Android hands the shell a
 * `com.peakmusicreviews.app://` deep link. That is how the OAuth code
 * gets back out of the system browser and into the WebView that owns
 * the PKCE verifier.
 */
export function appPlugin() {
  return bridge()?.Plugins?.App ?? null;
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
