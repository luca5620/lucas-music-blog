"use client";

/**
 * SheetFrame — the chrome around the share sheets: a dimmed backdrop
 * and a panel that rises from the bottom on phones and sits centred on
 * desktop. There's no text input inside, so a fixed overlay is safe
 * here (the iOS keyboard note in memory is about fixed boxes WITH
 * inputs).
 *
 * Escape and a tap on the backdrop close it; the page behind doesn't
 * scroll while it's open.
 */

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Never rendered on the server (it opens on a tap), but stay safe.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="share-sheet-backdrop" onClick={onClose}>
      <div
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share-sheet-head">
          <p className="share-sheet-title">{title}</p>
          <button type="button" className="share-sheet-x" onClick={onClose} aria-label={closeLabel}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
