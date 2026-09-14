"use client";

/**
 * AuxChatDock — how the room chat reaches a phone (Luca 2026-09-14:
 * "for the chat on mobile, have it follow the same exact way we do
 * releases where it sits at the bottom and you can slide it up").
 * This is deliberately the SAME machinery as ReleaseRoomChat, just
 * pointed at AuxChat instead of ChatPanel — one pattern, one set of
 * iOS-keyboard lessons, one bit of CSS (.live-sheet-* in globals.css).
 *
 * Desktop (xl+): AuxChat as the in-page column, unchanged.
 *
 * Phones (web + app): the chat LEAVES the page flow. A slim THE ROOM
 * bar hugs the bottom edge (above the app's tab bar); pressing it
 * (buttons only — no grab handle, no swipe gestures, Luca 2026-08-28)
 * slides a half-screen sheet up, so the stage, the songs and the
 * vote buttons stay in view above it. While typing, the sheet jumps
 * to the TOP of the page and fills exactly the visible area above the
 * keyboard (tracked through visualViewport) — the one placement iOS
 * can never cover, since WKWebView pans fixed elements when the
 * keyboard is up. It snaps back to the bottom half afterwards.
 *
 * AuxChat must mount exactly ONCE per room: its realtime channel
 * topic is `aux-chat:${roomId}` and supabase-js silently no-ops a
 * second subscribe on a duplicate topic. So the desktop/phone split
 * is a real matchMedia fork in JS, never CSS show/hide of two
 * mounted copies.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import AuxChat from "@/components/aux-battles/AuxChat";
import ShimmerLines from "@/components/ui/ShimmerLines";
import { hapticTap } from "@/lib/native";
import { useHydrated } from "@/lib/useHydrated";
import { useVisualViewport } from "@/lib/useVisualViewport";
import type { AuxMessageWithProfile } from "@/lib/db/aux-battles";

interface Props {
  roomId: string;
  hostId: string;
  initialMessages: AuxMessageWithProfile[];
  closed: boolean;
  /** How many messages the bar shows before you open it. */
  messageCount: number;
}

export default function AuxChatDock(props: Props) {
  // null until hydration tells us the viewport — see the mount-once
  // realtime note above for why this can't be CSS visibility.
  const [mode, setMode] = useState<"desktop" | "mobile" | null>(null);

  useEffect(() => {
    // 1280px = Tailwind xl, where the room page grows its chat column.
    const mq = window.matchMedia("(min-width: 1280px)");
    const apply = () => setMode(mq.matches ? "desktop" : "mobile");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (mode === "desktop") {
    return (
      <AuxChat
        roomId={props.roomId}
        hostId={props.hostId}
        initialMessages={props.initialMessages}
        closed={props.closed}
        className="xl:h-full"
      />
    );
  }
  if (mode === "mobile") return <AuxSheet {...props} />;
  // Pre-hydration: desktop keeps the column's shape so nothing jumps;
  // phones show nothing (the bar is fixed UI and can just appear).
  return (
    <div className="hidden xl:block panel-xbox p-5 xl:h-full">
      <ShimmerLines lines={6} />
    </div>
  );
}

/* ─── The phone bar + sheet ─── */

function AuxSheet({ roomId, hostId, initialMessages, closed, messageCount }: Props) {
  // The bar/sheet portal to document.body: the room's CRT chrome
  // makes transform/filter stacking contexts that would turn
  // position:fixed into position:absolute-inside-the-panel.
  const t = useTranslations("aux.chat");
  const mounted = useHydrated();
  const [open, setOpen] = useState(false);
  // Keyboard mode: composer focused → the sheet fills the top instead.
  const [kb, setKb] = useState(false);
  const vvBox = useVisualViewport(kb);
  const sheetRef = useRef<HTMLDivElement>(null);
  const blurTimer = useRef<number | null>(null);

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
    const el = e.target as HTMLElement;
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") setKb(true);
  };
  const handleBlur = (e: React.FocusEvent) => {
    // Focus moving WITHIN the sheet keeps keyboard mode.
    const next = e.relatedTarget as Node | null;
    if (next && sheetRef.current?.contains(next)) return;
    // A tap on Send blurs the textarea FIRST — the sheet must not snap
    // back down before the tap lands on the button that moved with it.
    blurTimer.current = window.setTimeout(() => setKb(false), 160);
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* ── The collapsed bar — press to open. It fades while the
          sheet slides so there's one motion, not two. ── */}
      <button
        type="button"
        onClick={openSheet}
        aria-label={t("openSheet")}
        aria-expanded={open}
        className={`live-sheet-fixed live-sheet-bottom live-sheet-pad w-full text-left bg-[#0c0c0f] border-t border-accent-primary/20 transition-opacity duration-200 ${
          // delay-150 on the way back only: the bar returns while the
          // closing sheet is already most of the way down.
          open ? "opacity-0 pointer-events-none" : "opacity-100 delay-150"
        }`}
      >
        <span className="flex items-center gap-2 px-4 h-12">
          <span className="glow-orb" style={{ animationDelay: "1s" }} />
          <span className="label-xbox">{t("title")}</span>
          {messageCount > 0 && (
            <span className="text-xs text-text-muted tabular-nums">({messageCount})</span>
          )}
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
          top/height/radius morph instead of a snap. ── */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-label={t("sheetAria")}
        inert={!open}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`live-sheet-panel live-sheet-half bg-[#0c0c0f] border-border-medium flex flex-col overflow-hidden ${
          kb ? "border-b rounded-b-2xl" : "live-sheet-pad border-t rounded-t-2xl"
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
          <AuxChat
            roomId={roomId}
            hostId={hostId}
            initialMessages={initialMessages}
            closed={closed}
            variant="sheet"
            onCollapse={closeSheet}
          />
        </div>
      </div>
    </>,
    document.body
  );
}
