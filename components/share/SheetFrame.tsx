"use client";

/**
 * SheetFrame — the chrome around the share sheets: a dimmed backdrop
 * and a panel that rises from the bottom on phones and sits centred on
 * desktop. There's no text input inside, so a fixed overlay is safe
 * here (the iOS keyboard note in memory is about fixed boxes WITH
 * inputs).
 *
 * Escape, the ✕ and a tap on the backdrop close it; the page behind
 * doesn't scroll while it's open.
 *
 * MOTION (Luca 2026-10-25: "it just pops up"):
 *   - opening: the backdrop fades in and the panel slides up from the
 *     bottom edge (CSS, .share-sheet / .share-sheet-backdrop).
 *   - closing: the same in reverse, THEN onClose — so the parent only
 *     unmounts the sheet once it has slid away.
 *   - resizing: whenever the contents change height (switching tabs,
 *     the progress bar appearing, a note showing up) the panel glides
 *     from its old height to the new one instead of jumping. A
 *     ResizeObserver watches the contents; the Web Animations API
 *     animates the wrapper between the two heights.
 * All of it is skipped when the device asks for reduced motion (NOT
 * by Low detail mode, which is on by default).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** How long the slide-away takes — matches share-fall in globals.css. */
const CLOSE_MS = 240;

/** True when the phone/computer is set to reduce motion. Low detail
    mode does NOT count: it's on by default and is about GPU-heavy
    decoration, while this is one cheap panel moving (see the note at
    the end of globals.css). */
function calm() {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function SheetFrame({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  /** Slide away first, then let the parent unmount us. */
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (calm()) {
      onClose();
      return;
    }
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [requestClose]);

  // --- The height glide. `outer` gets animated, `inner` gets measured.
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return;
    let last = inner.offsetHeight;
    let anim: Animation | null = null;
    const ro = new ResizeObserver(() => {
      const next = inner.offsetHeight;
      // Start from wherever a running glide currently is, so quick
      // changes in a row chain smoothly instead of snapping back.
      const from = anim ? outer.getBoundingClientRect().height : last;
      last = next;
      if (Math.abs(next - from) < 2 || calm()) return;
      anim?.cancel();
      // clip only while gliding (shrinking would spill out otherwise);
      // the rest of the time the card's shadow may hang over the edge
      outer.style.overflow = "hidden";
      anim = outer.animate([{ height: `${from}px` }, { height: `${next}px` }], {
        duration: 320,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      });
      const done = () => {
        anim = null;
        outer.style.overflow = "";
      };
      anim.onfinish = done;
      anim.oncancel = done;
    });
    ro.observe(inner);
    return () => {
      ro.disconnect();
      anim?.cancel();
    };
  }, []);

  // Never rendered on the server (it opens on a tap), but stay safe.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`share-sheet-backdrop${closing ? " is-closing" : ""}`} onClick={requestClose}>
      <div
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share-sheet-head">
          <p className="share-sheet-title">{title}</p>
          <button type="button" className="share-sheet-x" onClick={requestClose} aria-label={closeLabel}>
            ✕
          </button>
        </div>
        <div ref={outerRef} className="share-sheet-size">
          <div ref={innerRef}>{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
