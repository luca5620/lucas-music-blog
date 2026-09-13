"use client";

/**
 * NewRoomForm — host an aux battle (Luca 2026-09-13: "free range on
 * whatever topic, but with presets and a choice to pick random
 * topics as well, the host can participate if they choose").
 *
 * Fields: the topic (type anything, tap a preset chip, or 🎲 for a
 * random one — the presets live in messages/<locale>.json so they
 * read right in every language), the format (single round or best
 * of 3), who judges (the crowd's vote or the host), whether the host
 * plays, and private (a six-letter code shown once the room opens).
 * POSTs /api/aux-battles and lands in the new room's lobby.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { hapticTap } from "@/lib/native";

type Format = "bo1" | "bo3";
type Judge = "crowd" | "host";

/* A two-way choice as the same segmented pill the site uses everywhere.
   Module-level (not inside the form) so React keeps one identity for
   it across renders. */
function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string; sub: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              hapticTap();
              onChange(o.id);
            }}
            className={`text-left p-3 rounded-lg border transition-colors ${
              active
                ? "border-accent-primary bg-accent-primary/10"
                : "border-border-medium bg-black/25 hover:border-border-strong"
            }`}
          >
            <span
              className={`block text-sm font-bold font-[family-name:var(--font-heading)] ${
                active ? "text-accent-primary" : "text-text-primary"
              }`}
            >
              {active ? "● " : "○ "}
              {o.label}
            </span>
            <span className="block text-xs text-text-muted mt-0.5">{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function NewRoomForm() {
  const router = useRouter();
  const t = useTranslations("aux.new");
  const presets = useMemo(() => {
    const raw = t.raw("presets");
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [t]);

  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<Format>("bo1");
  const [judge, setJudge] = useState<Judge>("crowd");
  const [hostPlays, setHostPlays] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function randomTopic() {
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
    if (submitting) return;
    setError(null);
    if (topic.trim().length < 3) {
      setError(t("errors.topic"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/aux-battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          format,
          judge,
          host_plays: hostPlays,
          is_private: isPrivate,
        }),
      });
      const data = (await res.json()) as { room?: { slug: string }; error?: string };
      if (!res.ok || !data.room) throw new Error(data.error ?? t("errors.open"));
      router.push(`/aux-battles/${data.room.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.broke"));
      setSubmitting(false);
    }
  }

  const label ="block text-xs uppercase tracking-widest text-text-muted mb-1.5 font-[family-name:var(--font-heading)]";

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Topic */}
      <div>
        <label className={label}>{t("topic")}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={120}
            placeholder={t("topicPlaceholder")}
            className="form-input flex-1 min-w-0"
            autoFocus
          />
          <button
            type="button"
            onClick={randomTopic}
            title={t("random")}
            aria-label={t("random")}
            className="btn-y2k btn-y2k-outline !px-3 shrink-0"
          >
            🎲
          </button>
        </div>
        <p className="mt-1 text-[10px] text-text-muted tabular-nums text-right">{topic.length}/120</p>
        {presets.length > 0 && (
          <div className="mt-2">
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
      </div>

      {/* Format */}
      <div>
        <label className={label}>{t("format")}</label>
        <Choice
          value={format}
          onChange={setFormat}
          options={[
            { id: "bo1", label: t("bo1"), sub: t("bo1Sub") },
            { id: "bo3", label: t("bo3"), sub: t("bo3Sub") },
          ]}
        />
      </div>

      {/* Judge */}
      <div>
        <label className={label}>{t("judge")}</label>
        <Choice
          value={judge}
          onChange={setJudge}
          options={[
            { id: "crowd", label: t("crowd"), sub: t("crowdSub") },
            { id: "host", label: t("hostJudge"), sub: t("hostJudgeSub") },
          ]}
        />
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(
          [
            { id: "plays", on: hostPlays, set: setHostPlays, label: t("hostPlays"), sub: t("hostPlaysSub") },
            { id: "private", on: isPrivate, set: setIsPrivate, label: t("private"), sub: t("privateSub") },
          ] as const
        ).map((row) => (
          <button
            key={row.id}
            type="button"
            role="switch"
            aria-checked={row.on}
            onClick={() => {
              hapticTap();
              row.set(!row.on);
            }}
            className={`text-left p-3 rounded-lg border transition-colors ${
              row.on ? "border-accent-primary bg-accent-primary/10" : "border-border-medium bg-black/25"
            }`}
          >
            <span
              className={`block text-sm font-bold font-[family-name:var(--font-heading)] ${
                row.on ? "text-accent-primary" : "text-text-primary"
              }`}
            >
              {row.on ? "■ " : "□ "}
              {row.label}
            </span>
            <span className="block text-xs text-text-muted mt-0.5">{row.sub}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-accent-rose">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={submitting} className="btn-y2k btn-y2k-primary disabled:opacity-50">
          {submitting ? t("opening") : t("open")}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={submitting}
          className="btn-y2k btn-y2k-outline disabled:opacity-50"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
