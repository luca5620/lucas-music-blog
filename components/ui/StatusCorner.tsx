"use client";

import { useLayoutEffect, useRef } from "react";
import { useIsNativeApp } from "@/lib/useIsNativeApp";

/**
 * StatusCorner — the iPhone Duo's "clock + wifi in the top-right
 * corner" problem (Luca, 2026-11-16, simulator pass).
 *
 * On an ordinary iPhone the status bar is a full-width band along the
 * top and the page starts below it. On the Duo the clock and wifi are
 * a small BLOCK in the top-right corner instead, and iOS reports it
 * as a whole reserved edge:
 *   - front screen + unfolded sideways: a strip down the RIGHT side
 *     (safe-area-inset-right ≈ 82pt) — following it left the whole
 *     site and the tab bar shoved to the left with a dead black strip
 *     beside them;
 *   - unfolded upright: a tall band along the TOP (inset-top ≈ 85pt)
 *     that is empty except for its right-hand corner.
 * Luca: "find a way to compromise to still get a fully functioning
 * fullscreen experience accounting for that top right issue".
 *
 * The compromise: the page takes the WHOLE screen, and only what is
 * actually up in that corner steps around it. This component renders
 * one invisible box floated into the top-right of the page, sized to
 * the clock/wifi block. Ordinary CSS float rules then do the work: the
 * header row (and, on the small front screen, whatever sits right
 * under it) narrows beside the box, and everything below the box runs
 * full width. Scrolled content passes under the clock exactly like it
 * already does under a normal status bar.
 *
 * It tags <html> so globals.css ("STATUS CORNER") can drop the side
 * padding and re-seat the header:
 *   .status-corner        — either case
 *   .status-corner-side   — the block is reported as a right-hand strip
 *   .status-corner-top    — the block is reported as a tall top band
 * and sets --corner-w / --corner-h (the block's size, from the screen's
 * top-right corner) plus --corner-float-w / --corner-float-h (the size
 * of the floated box, i.e. the part of the block that reaches into the
 * page's content area).
 *
 * App-only, and only on a screen shaped like this. An ordinary iPhone
 * has no side inset upright, equal insets on both sides when turned
 * sideways, and a top inset of at most ~62pt — it matches neither
 * case, so nothing here touches the approved layout.
 */

/** A side inset this wide on ONE side only = the Duo's status strip. */
const SIDE_MIN = 60;
const OTHER_SIDE_MAX = 24;
/** Upright unfolded: a top band taller than any ordinary iPhone's
    (Dynamic Island phones are ~62pt), on a screen too wide to be one. */
const TOP_BAND_MIN = 72;
const TOP_BAND_MIN_WIDTH = 560;

/* iOS tells us ONE dimension of the block (the inset); the other isn't
   exposed anywhere, so these come from measuring simulator screenshots
   (2026-11-16, iOS 27.1). If Apple moves the icons, re-measure. */
/** Side strip, front screen: camera + clock + wifi stacked, bottom at ~152pt. */
const SIDE_BLOCK_H_FRONT = 158;
/** Side strip, unfolded sideways: clock + wifi only, bottom at ~99pt. */
const SIDE_BLOCK_H_INNER = 104;
/** Below this width a side strip means the front screen. */
const FRONT_SCREEN_MAX_WIDTH = 600;
/** Top band, unfolded upright: clock + wifi side by side, ~130pt wide. */
const TOP_BLOCK_W = 140;

/** env(safe-area-inset-*) in real pixels, via a hidden probe. */
function measureInsets(): { top: number; left: number; right: number } {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;" +
    "padding-top:env(safe-area-inset-top,0px);" +
    "padding-left:env(safe-area-inset-left,0px);" +
    "padding-right:env(safe-area-inset-right,0px)";
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = {
    top: parseFloat(style.paddingTop) || 0,
    left: parseFloat(style.paddingLeft) || 0,
    right: parseFloat(style.paddingRight) || 0,
  };
  probe.remove();
  return insets;
}

export default function StatusCorner() {
  const native = useIsNativeApp();
  const boxRef = useRef<HTMLElement>(null);

  // A layout effect, so the first paint already has the page full
  // width and the header in place — no hop. Re-run on every resize,
  // which is what folding, unfolding and rotating fire; the delayed
  // second pass is because the insets can settle a beat after the size.
  useLayoutEffect(() => {
    if (!native) return;
    const root = document.documentElement;
    const box = boxRef.current;
    const screen = box?.parentElement;
    if (!box || !screen) return;

    const apply = () => {
      const { top, left, right } = measureInsets();
      const width = window.innerWidth;

      let mode: "side" | "top" | null = null;
      let blockW = 0;
      let blockH = 0;
      if (right >= SIDE_MIN && left < OTHER_SIDE_MAX) {
        mode = "side";
        blockW = right;
        blockH = width < FRONT_SCREEN_MAX_WIDTH ? SIDE_BLOCK_H_FRONT : SIDE_BLOCK_H_INNER;
      } else if (
        left < OTHER_SIDE_MAX &&
        right < OTHER_SIDE_MAX &&
        top >= TOP_BAND_MIN &&
        width >= TOP_BAND_MIN_WIDTH
      ) {
        mode = "top";
        blockW = TOP_BLOCK_W;
        blockH = top;
      }

      root.classList.toggle("status-corner", mode !== null);
      root.classList.toggle("status-corner-side", mode === "side");
      root.classList.toggle("status-corner-top", mode === "top");
      if (mode === null) {
        for (const name of ["--corner-w", "--corner-h", "--corner-float-w", "--corner-float-h"]) {
          root.style.removeProperty(name);
        }
        return;
      }

      // The block's size first: the CSS re-seats the page from these,
      // and the measurements below must see that final layout.
      root.style.setProperty("--corner-w", `${blockW}px`);
      root.style.setProperty("--corner-h", `${blockH}px`);
      root.style.setProperty("--corner-float-w", "0px");
      root.style.setProperty("--corner-float-h", "0px");

      // How far the block reaches into the content area. Sideways: from
      // the content's right edge (the screen keeps its own padding).
      const screenRect = screen.getBoundingClientRect();
      const screenStyle = getComputedStyle(screen);
      const contentRight =
        screenRect.right -
        (parseFloat(screenStyle.paddingRight) || 0) -
        (parseFloat(screenStyle.borderRightWidth) || 0);
      const floatW = Math.max(0, blockW - (width - contentRight));

      // Downwards: from where the content starts. offsetTop up the
      // chain = distance from the top of the page, whatever the scroll.
      let boxTop = 0;
      for (let node: HTMLElement | null = box; node; node = node.offsetParent as HTMLElement | null) {
        boxTop += node.offsetTop;
      }
      let floatH = Math.max(0, blockH - boxTop);

      // If the block ends only a sliver below the header, stop the box
      // at the header: narrowing the next row for a few pixels of
      // overlap costs more than it saves.
      const nav = screen.querySelector<HTMLElement>(":scope > nav");
      if (nav && floatH <= nav.offsetHeight + 20) {
        floatH = Math.min(floatH, nav.offsetHeight + 8);
      }

      root.style.setProperty("--corner-float-w", `${floatW}px`);
      root.style.setProperty("--corner-float-h", `${floatH}px`);
    };

    let settle: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      apply();
      if (settle) clearTimeout(settle);
      settle = setTimeout(apply, 350);
    };
    apply();
    window.addEventListener("resize", onResize);
    return () => {
      if (settle) clearTimeout(settle);
      window.removeEventListener("resize", onResize);
      root.classList.remove("status-corner", "status-corner-side", "status-corner-top");
      for (const name of ["--corner-w", "--corner-h", "--corner-float-w", "--corner-float-h"]) {
        root.style.removeProperty(name);
      }
    };
  }, [native]);

  // Always in the markup (server and browser must render the same),
  // but display:none unless <html> carries .status-corner.
  return <i ref={boxRef} className="status-corner-box" aria-hidden="true" />;
}
