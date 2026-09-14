"use client";

/**
 * TopicPicker — the host names each ROUND's topic (Luca 2026-09-13:
 * "for each round there should be a new topic"). Free text, preset
 * chips, 🎲 random — the presets live in messages/<locale>.json so
 * they read right in every language. POSTs /api/aux-wars/[id]/topic,
 * which stamps the topic on every match of the current round; the
 * realtime match UPDATE then unlocks the song pickers on every screen.
 */

import { useMemo, useState } from "react";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { hapticTap } from "@/lib/native";

export default function TopicPicker({
  roomId,
  round,
  game,
}: {
  roomId: string;
  round: number;
  /** The game number in a "topic each game" bo3 room (migration 046),
      null everywhere else. Only changes the heading — the route knows
      from the room row which one it's writing. */
  game?: number | null;
}) {
  const t = useTranslations("aux.topic");
  const presets = useMemo(() => {
    const raw = t.raw("presets");
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [t]);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function random() {
    if (presets.length === 0) return;
    hapticTap();
    let next = presets[Math.floor(Math.random() * presets.length)];
    if (next === topic && presets.length > 1) {
      next = presets[(presets.indexOf(next) + 1) % presets.length];
    }
    setTopic(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (topic.trim().length < 3) {
      setError(t("errors.topic"));
      return;
    }
    hapticTap();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/aux-wars/${roomId}/topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("errors.broke"));
      // The realtime match UPDATE swaps this picker out; nothing to do.
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.broke"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <span className="block text-xs uppercase tracking-widest text-osd-amber font-[family-name:var(--font-heading)]">
          {game ? t("titleGame", { n: game }) : t("title", { n: round })}
        </span>
        <p className="text-xs text-text-muted mt-0.5">{t("sub")}</p>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={120}
          placeholder={t("placeholder")}
          className="form-input flex-1 min-w-0"
          autoFocus
        />
        <button
          type="button"
          onClick={random}
          title={t("random")}
          aria-label={t("random")}
          className="btn-y2k btn-y2k-outline !px-3 shrink-0"
        >
          🎲
        </button>
      </div>
      {presets.length > 0 && (
        <div>
          <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">
            {t("presetsLabel")}
          </span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  hapticTap();
                  setTopic(p);
                }}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  topic === p
                    ? "border-accent-primary text-accent-primary bg-accent-primary/10"
                    : "border-border-medium text-text-secondary hover:text-text-primary hover:border-border-strong"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-accent-rose">{error}</p>}
      <button type="submit" disabled={busy || topic.trim().length < 3} className="btn-y2k btn-y2k-primary disabled:opacity-50">
        {busy ? t("setting") : t("set")}
      </button>
    </form>
  );
}
