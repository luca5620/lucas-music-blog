"use client";

/**
 * GifAttach — the "+ GIF" control for a form (2026-10-11).
 *
 * Three states, one slot:
 *  - nothing attached → a small "+ GIF" button
 *  - picking          → the GifPicker, in flow (see its header)
 *  - attached         → the GIF with a ✕ to remove it
 *
 * Renders nothing at all when no KLIPY key is configured, so the
 * feature stays invisible until the key is on Vercel.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import GifPicker from "@/components/ui/GifPicker";
import GifView from "@/components/ui/GifView";
import { KLIPY_APP_KEY, type Gif } from "@/lib/gif";

export default function GifAttach({
  gif,
  onChange,
  size = "md",
}: {
  gif: Gif | null;
  onChange: (gif: Gif | null) => void;
  size?: "sm" | "md";
}) {
  const t = useTranslations("gifs");
  const [open, setOpen] = useState(false);

  if (!KLIPY_APP_KEY) return null;

  if (gif) {
    return (
      <div className="relative inline-block">
        <GifView gif={gif} size={size} />
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t("remove")}
          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/75 border border-white/20 text-white text-xs hover:bg-black transition-colors"
        >
          ✕
        </button>
      </div>
    );
  }

  if (open) {
    return (
      <GifPicker
        onPick={(picked) => {
          onChange(picked);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase text-text-muted hover:text-accent-primary border border-border-subtle hover:border-accent-primary/40 transition-colors font-[family-name:var(--font-heading)]"
    >
      + {t("add")}
    </button>
  );
}
