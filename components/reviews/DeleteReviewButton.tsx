"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface DeleteReviewButtonProps {
  reviewId: string;
  reviewTitle: string;
}

export default function DeleteReviewButton({
  reviewId,
  reviewTitle,
}: DeleteReviewButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const t = useTranslations("reviews.deleteButton");
  const tc = useTranslations("common");

  async function handleDelete() {
    setDeleting(true);

    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.refresh();
      }
    } catch {
      // silently fail
    }

    setDeleting(false);
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className="text-xs text-[#9a9a9e] font-[family-name:var(--font-vt323)]">
          {t("confirm", { title: reviewTitle })}
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-2 py-0.5 rounded text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors font-[family-name:var(--font-heading)] uppercase tracking-wider disabled:opacity-50"
        >
          {deleting ? "..." : tc("yes")}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2 py-0.5 rounded text-xs font-bold text-[#9a9a9e] hover:text-[#e8e6e3] transition-colors font-[family-name:var(--font-heading)] uppercase tracking-wider"
        >
          {tc("no")}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-accent-rose hover:bg-accent-rose/10 transition-colors font-[family-name:var(--font-heading)]"
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      {tc("delete")}
    </button>
  );
}
