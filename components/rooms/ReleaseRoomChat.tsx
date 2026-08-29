"use client";

/**
 * ReleaseRoomChat — how the live room reaches the release page
 * (Luca 2026-08-28: "prioritize what people are saying").
 *
 * Desktop (xl+): the classic ChatPanel column, unchanged.
 *
 * Phones (web + app): the chat LEAVES the page flow. A slim LIVE
 * ROOM bar hugs the bottom edge (above the app's tab bar); pressing
 * it (buttons only — no slide gestures, no grab handle, Luca
 * 2026-08-28) opens a half-screen sheet, so the countdown /
 * artwork / Spotify preview stay in view above while you watch the
 * chat. While typing, the sheet jumps to the TOP of the page and
 * fills exactly the visible area above the keyboard (tracked via
 * visualViewport) — the ReportButton pattern, the one placement the
 * iOS keyboard can never cover (WKWebView pans fixed elements when
 * the keyboard is up, so a bottom-anchored composer drifts). It
 * snaps back to the bottom half when the keyboard goes away.
 *
 * ChatPanel must mount exactly ONCE per room: its realtime channel
 * topic is `room:${id}:chat`, and supabase-js silently no-ops a
 * second subscribe on a duplicate topic (see ChatPanel's header
 * comment) — so the desktop/phone split is a real JS matchMedia
 * fork, never CSS show/hide of two mounted panels.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ChatPanel, {
  type ChatMessageWithProfile,
} from "@/components/rooms/ChatPanel";
import LiveBadge from "@/components/rooms/LiveBadge";
import ShimmerLines from "@/components/ui/ShimmerLines";
import { hapticTap } from "@/lib/native";
import type {
  ReactionCountRow,
  ViewerReactionRow,
} from "@/components/chat/useMessageReactions";
import type { ReleaseRoom } from "@/lib/types/database";

interface Props {
  releaseId: string;
  initialMessages: ChatMessageWithProfile[];
  initialRoom: ReleaseRoom;
  accentColor: string;
  initialReactionCounts: ReactionCountRow[];
  initialViewerReactions: ViewerReactionRow[];
}

export default function ReleaseRoomChat(props: Props) {
  // null until hydration tells us the viewport — see the mount-once
  // realtime note above for why this can't be CSS visibility.
  const [mode, setMode] = useState<"desktop" | "mobile" | null>(null);

  useEffect(() => {
    // 1280px = Tailwind xl, the breakpoint where the release page
    // grows its dedicated chat column.
    const mq = window.matchMedia("(min-width: 1280px)");
    const apply = () => setMode(mq.matches ? "desktop" : "mobile");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (mode === "desktop") return <ChatPanel {...props} />;
  if (mode === "mobile") return <LiveRoomSheet {...props} />;
  // Pre-hydration: desktop gets a skeleton in the column so the
  // layout doesn't jump; phones show nothing (the bar is fixed UI
  // and can simply appear).
  return (
    <div className="hidden xl:block panel-xbox p-5 xl:h-full">
      <ShimmerLines lines={6} />
    </div>
  );
}

/* ─── The phone bar + sheet ─── */

function LiveRoomSheet({
  releaseId,
  initialMessages,
  initialRoom,
  accentColor,
  initialReactionCounts,
  initialViewerReactions,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  // Keyboard mode: composer focused → sheet fills the top instead.
  const [kb, setKb] = useState(false);
  // The visible area above the keyboard, in layout-viewport coords.
  const [vvBox, setVvBox] = useState<{ top: number; height: number } | null>(
    null
  );
  const sheetRef = useRef<HTMLDivElement>(null);
  const blurTimer = useRef<number | null>(null);

  // The bar/sheet portal to document.body: the release panel's CRT
  // chrome creates transform/filter stacking contexts that would
  // turn position:fixed into position:absolute-in-the-panel.
  useEffect(() => setMounted(true), []);

  // While typing, glue the sheet to the visual viewport so it fills
  // exactly the space above the keyboard, wherever iOS pans it.
  useEffect(() => {
    if (!kb) {
      setVvBox(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const measure = () =>
      setVvBox({ top: vv.offsetTop, height: vv.height });
    measure();
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    return () => {
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
    };
  }, [kb]);

  useEffect(
    () => () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
    },
    []
  );

  const openSheet = () => {
    hapticTap();
    setOpen(true);
  };
  const closeSheet = () => {
    hapticTap();
    setKb(false);
    setOpen(false);
  };

  const handleFocus = (e: React.FocusEvent) => {
    if (blurTimer.current) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    const t = e.target as HTMLElement;
    if (t.tagName === "TEXTAREA" || t.tagName === "INPUT") setKb(true);
  };
  const handleBlur = (e: React.FocusEvent) => {
    // Focus moving WITHIN the sheet keeps keyboard mode.
    const next = e.relatedTarget as Node | null;
    if (next && sheetRef.current?.contains(next)) return;
    // Small delay: a tap on Send blurs the textarea FIRST — the sheet
    // must not snap back to the bottom before the tap lands on the
    // button that just moved with it.
    blurTimer.current = window.setTimeout(() => setKb(false), 160);
  };

  const messageCount = initialMessages.length;

  if (!mounted) return null;

  return createPortal(
    <>
      {/* ── Collapsed bar — press to open (buttons only, no slide
          gesture: Luca 2026-08-28). It fades while the sheet slides
          so there's one clean motion, not two. ── */}
      <button
        type="button"
        onClick={openSheet}
        aria-label="Open the live room"
        aria-expanded={open}
        className={`live-sheet-fixed live-sheet-bottom live-sheet-pad w-full text-left bg-[#0c0c0f] border-t transition-opacity duration-200 ${
          // delay-150 on the return trip only: the bar fades back in
          // while the closing sheet is already most of the way down.
          open ? "opacity-0 pointer-events-none" : "opacity-100 delay-150"
        }`}
        style={{ borderColor: `${accentColor}30` }}
      >
        <span className="flex items-center gap-2 px-4 h-12">
          <span
            className="glow-orb"
            style={{
              background: accentColor,
              boxShadow: `0 0 10px ${accentColor}`,
            }}
          />
          <span className="label-xbox">Live Room</span>
          <span className="text-xs text-text-muted">({messageCount})</span>
          <LiveBadge lastActivityAt={initialRoom.last_activity_at} />
          {/* The up arrow = the press affordance (mirrors the header's
              chevron-down that tucks the sheet away). */}
          <span className="ml-auto w-8 h-8 rounded-full border border-border-medium text-text-secondary inline-flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </span>
        </span>
      </button>

      {/* ── The sheet — half the page; top-filling while typing.
          live-sheet-half carries the half-open top/height; keyboard
          mode overrides them inline, so bottom↔top is a smooth
          top/height/radius morph (transitions in .live-sheet-panel)
          instead of a snap. No grab handle, no drag gestures — the
          header's chevron-down (onCollapse) is the way back down. ── */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-label="Live room chat"
        inert={!open}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`live-sheet-panel live-sheet-half bg-[#0c0c0f] border-border-medium flex flex-col overflow-hidden ${
          kb
            ? "border-b rounded-b-2xl"
            : "live-sheet-pad border-t rounded-t-2xl"
        } ${open ? "live-sheet-open" : ""}`}
        style={
          kb
            ? {
                top: vvBox ? vvBox.top : 0,
                height: vvBox ? vvBox.height : "50vh",
                paddingTop: "env(safe-area-inset-top, 0px)",
              }
            : undefined
        }
      >
        <div className="flex-1 min-h-0">
          <ChatPanel
            releaseId={releaseId}
            initialMessages={initialMessages}
            initialRoom={initialRoom}
            accentColor={accentColor}
            initialReactionCounts={initialReactionCounts}
            initialViewerReactions={initialViewerReactions}
            variant="sheet"
            onCollapse={closeSheet}
          />
        </div>
      </div>
    </>,
    document.body
  );
}
