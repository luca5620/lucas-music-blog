"use client";

/**
 * useEmbedVolume — points the site-wide volume (lib/volume.ts) at ONE
 * embedded player, through whatever door that service left open.
 *
 *   soundcloud → SoundCloud's Widget API (w.soundcloud.com/player/api.js,
 *                loaded lazily the first time a SoundCloud player is on
 *                screen; allowed in next.config.ts script-src).
 *   youtube    → YouTube's IFrame API protocol, by postMessage straight
 *                at the frame — no script to load. The src MUST carry
 *                enablejsapi=1 or the player ignores the command.
 *
 * Spotify and Apple Music expose no volume control at all, so nothing
 * here tries: pass their source and the hook simply does nothing.
 *
 * Everything fails soft. A blocked script, a player that never loads,
 * a service that changes its protocol — the worst case is that the
 * slider doesn't move that player, never a broken page.
 */

import { useEffect, useRef } from "react";
import {
  getVolume,
  isControllable,
  registerPlayer,
  subscribeVolume,
} from "@/lib/volume";

/* ---- SoundCloud's widget script, loaded once, on demand ---- */

interface SCWidget {
  setVolume: (v: number) => void;
  bind: (event: string, fn: () => void) => void;
}
interface SCApi {
  Widget: ((el: HTMLIFrameElement) => SCWidget) & { Events: { READY: string } };
}

let scLoader: Promise<SCApi | null> | null = null;

function loadSoundCloudApi(): Promise<SCApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const existing = (window as unknown as { SC?: SCApi }).SC;
  if (existing) return Promise.resolve(existing);
  if (scLoader) return scLoader;

  scLoader = new Promise<SCApi | null>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://w.soundcloud.com/player/api.js";
    script.async = true;
    script.onload = () => resolve((window as unknown as { SC?: SCApi }).SC ?? null);
    script.onerror = () => resolve(null); // fail soft — no volume control, still plays
    document.head.appendChild(script);
  });
  return scLoader;
}

/* ---- The hook ---- */

export function useEmbedVolume(
  ref: React.RefObject<HTMLIFrameElement | null>,
  source: string | null | undefined
) {
  // The widget handle, once SoundCloud hands us one.
  const widgetRef = useRef<SCWidget | null>(null);

  // Tell the site-wide dock a controllable player is on screen, for
  // exactly as long as this one is mounted.
  useEffect(() => {
    if (!isControllable(source)) return;
    return registerPlayer();
  }, [source]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !isControllable(source)) return;
    let cancelled = false;

    /* --- how one level reaches this player --- */
    const apply = (v: number) => {
      if (cancelled) return;
      if (source === "soundcloud") {
        widgetRef.current?.setVolume(v);
        return;
      }
      // YouTube: the documented postMessage command protocol.
      try {
        el.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "setVolume", args: [v] }),
          "https://www.youtube-nocookie.com"
        );
      } catch {
        // A frame that isn't ready yet just drops it; the retry below covers it.
      }
    };

    if (source === "soundcloud") {
      void loadSoundCloudApi().then((SC) => {
        if (cancelled || !SC || !ref.current) return;
        try {
          const widget = SC.Widget(ref.current);
          widgetRef.current = widget;
          // READY fires once the widget can take commands; set it then,
          // and again on every later change through the subscription.
          widget.bind(SC.Widget.Events.READY, () => {
            if (!cancelled) widget.setVolume(getVolume());
          });
        } catch {
          widgetRef.current = null;
        }
      });
    } else {
      // The YouTube player accepts commands a beat after the frame
      // loads, and there is no cross-origin "ready" we can read — so
      // apply on load and re-send a few times over the first seconds.
      const onLoad = () => apply(getVolume());
      el.addEventListener("load", onLoad);
      const timers = [300, 900, 2000, 4000].map((ms) =>
        window.setTimeout(() => apply(getVolume()), ms)
      );
      const unsubscribeYt = subscribeVolume(apply);
      return () => {
        cancelled = true;
        el.removeEventListener("load", onLoad);
        for (const t of timers) window.clearTimeout(t);
        unsubscribeYt();
      };
    }

    const unsubscribe = subscribeVolume(apply);
    return () => {
      cancelled = true;
      unsubscribe();
      widgetRef.current = null;
    };
  }, [ref, source]);
}
