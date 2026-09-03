"use client";

/**
 * CreateSheet — the app's create menu (Luca 2026-08-31 swap: the
 * tab bar's middle slot became a blue CREATE button and search moved
 * to the header). Tapping CREATE pops this slide-up sheet with the
 * four things you can make — same rows as the web header's CREATE
 * dropdown, same slide-up format as the live-room sheet.
 *
 * Mechanics notes (both are standing repo gotchas):
 *  - PORTALED to document.body: the CRT shell's stacking contexts
 *    trap position:fixed, so in-tree fixed elements land wrong.
 *  - Two-phase close: stays mounted through the slide-down animation
 *    (sheet-anim-out) and unmounts on animationend — otherwise the
 *    dismiss just pops.
 * z-index 55 (.live-sheet-fixed) keeps the tab bar (60) visible and
 * tappable above the sheet, exactly like the live-room sheet.
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { hapticTap } from "@/lib/native";
import { useTranslations } from "next-intl";

// `label`/`sub` are keys into messages/<locale>.json → "create"
// (LANGUAGES, i18n/config.ts); the words are looked up at render time.
const CREATE_OPTIONS = [
  { href: "/reviews/new", icon: "★", label: "review", sub: "reviewSub" },
  { href: "/posts/new", icon: "▶", label: "post", sub: "postSub" },
  { href: "/lists/new", icon: "≣", label: "list", sub: "listSub" },
  { href: "/debates/new", icon: "⚔", label: "debate", sub: "debateSub" },
] as const;

export default function CreateSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Two-phase mount: render while open OR while animating out. When
  // `open` flips true the flag is raised DURING render (React's
  // adjust-state-on-prop-change pattern) instead of in an effect —
  // same result, one render pass less, and no setState-in-effect.
  // LANGUAGES: the four cards + header/close come from messages → "create".
  const t = useTranslations("create");
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  if (!mounted || typeof document === "undefined") return null;

  const closing = !open;

  return createPortal(
    <>
      {/* Dim — tap anywhere outside to dismiss */}
      <div
        className={`fixed inset-0 z-[54] bg-black/60 ${
          closing ? "sheet-dim-out" : "sheet-dim-in"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* The sheet — above the dim, below the tab bar */}
      <div
        className={`live-sheet-fixed live-sheet-bottom live-sheet-pad ${
          closing ? "sheet-anim-out" : "sheet-anim-in"
        }`}
        role="dialog"
        aria-label={t("title")}
        onAnimationEnd={() => {
          if (closing) setMounted(false);
        }}
      >
        <div className="mx-2 mb-2 rounded-2xl bg-[#141418] border border-white/10 shadow-[0_-8px_40px_rgba(0,0,0,0.7)] overflow-hidden">
          {/* Header row — label + close, matching the live-room sheet's
              buttons-only dismissal (no swipe affordances on sheets) */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="label-xbox">{t("title")}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="w-7 h-7 rounded-full border border-white/10 text-text-muted hover:text-text-primary flex items-center justify-center text-sm"
            >
              ✕
            </button>
          </div>

          <div className="p-2 space-y-1.5">
            {CREATE_OPTIONS.map((opt) => (
              <Link
                key={opt.href}
                href={opt.href}
                onClick={() => {
                  hapticTap();
                  onClose();
                }}
                className="group flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 transition-all hover:border-accent-primary/60 hover:bg-accent-primary/10"
              >
                <span className="w-8 h-8 shrink-0 rounded-full border border-accent-primary/30 bg-accent-primary/10 flex items-center justify-center text-base">
                  {opt.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-text-primary font-[family-name:var(--font-heading)] uppercase tracking-wide">
                    {t(opt.label)}
                  </span>
                  <span className="block text-xs text-text-muted">
                    {t(opt.sub)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
