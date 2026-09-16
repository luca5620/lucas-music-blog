"use client";

/**
 * ShellLiquid — mounts a shell liquid field only where it is actually
 * visible.
 *
 * The shell declares three of them and CSS shows at most ONE:
 *   `.crt-liquid`        the web screen          (hidden in the app)
 *   `.crt-bezel-liquid`  the app's single field  (hidden on the web)
 *   `.liquid-room`       the glow beside the TV  (hidden ≤640px and
 *                                                 in the app)
 * A hidden canvas is not a free canvas, though: every one of them was
 * creating a WebGL context, compiling the shader pair and running a
 * 400ms palette poll for the life of the page. A phone paid for three
 * and could only ever see one — and iOS caps how many live contexts a
 * page may hold at all (PERFORMANCE pass, 2026-09-15).
 *
 * The server renders the web pair, because the server cannot know and
 * the web is the safe default; inside the app the swap happens on
 * hydration, which is invisible for something decorative.
 */

import { useSyncExternalStore } from "react";
import { useIsNativeApp } from "@/lib/useIsNativeApp";
import LiquidField from "@/components/ui/LiquidField";

/** Mirrors the `@media (max-width: 640px)` rule that hides the room. */
const ROOM_QUERY = "(min-width: 641px)";

const subscribeWide = (onChange: () => void) => {
  const mq = matchMedia(ROOM_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

export default function ShellLiquid({ where }: { where: "app" | "web" | "room" }) {
  const native = useIsNativeApp();
  // Server snapshot true: desktop is the safe default, so a wide
  // browser gets the room in its first paint instead of after it.
  const wide = useSyncExternalStore(
    subscribeWide,
    () => matchMedia(ROOM_QUERY).matches,
    () => true
  );

  if (where === "app") return native ? <LiquidField context="site" tall /> : null;
  if (where === "web") return native ? null : <LiquidField context="site" tall />;
  return native || !wide ? null : <LiquidField context="room" />;
}
