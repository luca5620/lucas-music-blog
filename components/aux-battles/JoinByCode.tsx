"use client";

/**
 * JoinByCode — the index-page door into a private room: the host
 * shares the room LINK and the CODE; with only the code the visitor
 * still needs the link, so this box takes either the link (or slug)
 * or nothing and sends them to the room's code gate. Keeps the index
 * simple: one small input, one button.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";

export default function JoinByCode() {
  const t = useTranslations("aux.index");
  const router = useRouter();
  const [value, setValue] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const raw = value.trim();
    if (!raw) return;
    // Accept the full room link or just the slug.
    const m = raw.match(/aux-battles\/([a-z0-9-]+)/i);
    const slug = (m ? m[1] : raw).toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!slug) return;
    router.push(`/aux-battles/${slug}`);
  }

  return (
    <form onSubmit={go} className="flex gap-2 w-full sm:w-auto">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("joinPlaceholder")}
        className="form-input flex-1 min-w-0 sm:w-64 !py-2"
        autoComplete="off"
      />
      <button type="submit" disabled={!value.trim()} className="btn-y2k btn-y2k-outline shrink-0 disabled:opacity-40">
        {t("joinGo")}
      </button>
    </form>
  );
}
