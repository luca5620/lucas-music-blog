"use client";

/**
 * NewRoomForm — host an Aux War (Luca 2026-09-13). The room gets a
 * NAME here; the TOPICS come later, one per round, named by the host
 * as each round opens (TopicPicker on the stage) — "don't just choose
 * a topic at the beginning".
 *
 * Fields: the room name, the format (single round or best of 3), who
 * judges (the crowd's vote or the host), and two OPTIONS that combine
 * any way you like — the host playing too, and private (a six-letter
 * code shown once the room opens). POSTs /api/aux-wars and lands
 * in the new room's lobby.
 */

import { useState } from "react";
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

  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("bo1");
  const [judge, setJudge] = useState<Judge>("crowd");
  const [hostPlays, setHostPlays] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  // The "truly private" box (Luca 2026-09-14). A private room is only
  // about who can PLAY; by default the crowd still watches and votes.
  // This is the one that shuts the doors and the windows.
  const [isHidden, setIsHidden] = useState(false);
  // bo3 only (migration 046): a fresh topic before every game of a
  // match, instead of one brief for the whole best-of-3.
  const [topicEachGame, setTopicEachGame] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (name.trim().length < 3) {
      setError(t("errors.name"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/aux-wars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          format,
          judge,
          host_plays: hostPlays,
          is_private: isPrivate,
          // Hiding only means anything for a private room.
          is_hidden: isPrivate && isHidden,
          // …and a topic per game only means anything in a best-of-3.
          topic_each_game: format === "bo3" && topicEachGame,
        }),
      });
      const data = (await res.json()) as { room?: { slug: string }; error?: string };
      if (!res.ok || !data.room) throw new Error(data.error ?? t("errors.open"));
      router.push(`/aux-wars/${data.room.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.broke"));
      setSubmitting(false);
    }
  }

  const label = "block text-xs uppercase tracking-widest text-text-muted mb-1.5 font-[family-name:var(--font-heading)]";

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Room name */}
      <div>
        <label className={label}>{t("name")}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder={t("namePlaceholder")}
          className="form-input"
          autoFocus
        />
        <div className="flex items-baseline justify-between gap-3 mt-1">
          <p className="text-xs text-text-muted">{t("nameHint")}</p>
          <p className="text-[10px] text-text-muted tabular-nums shrink-0">{name.length}/120</p>
        </div>
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

        {/* Only a best-of-3 has games to give separate topics to.
            Same fold-in animation as the private sub-option, so the
            form grows instead of jumping. */}
        <div className={`aux-reveal ${format === "bo3" ? "aux-reveal-on" : ""}`} inert={format !== "bo3"}>
          <button
            type="button"
            role="checkbox"
            aria-checked={topicEachGame}
            tabIndex={format === "bo3" ? 0 : -1}
            onClick={() => {
              hapticTap();
              setTopicEachGame(!topicEachGame);
            }}
            className={`mt-2 w-full text-left p-3 rounded-lg border transition-colors ${
              topicEachGame
                ? "border-accent-primary bg-accent-primary/10"
                : "border-border-medium bg-black/25"
            }`}
          >
            <span
              className={`block text-sm font-bold font-[family-name:var(--font-heading)] ${
                topicEachGame ? "text-accent-primary" : "text-text-primary"
              }`}
            >
              {topicEachGame ? "☑ " : "☐ "}
              {t("topicEachGame")}
            </span>
            <span className="block text-xs text-text-muted mt-0.5">
              {topicEachGame ? t("topicEachGameOnSub") : t("topicEachGameOffSub")}
            </span>
          </button>
        </div>
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

      {/* Options — any combination (Luca: say so explicitly) */}
      <div>
        <label className={label}>
          {t("options")}
          <span className="normal-case tracking-normal text-text-muted"> · {t("optionsHint")}</span>
        </label>
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
              role="checkbox"
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
                {row.on ? "☑ " : "☐ "}
                {row.label}
              </span>
              <span className="block text-xs text-text-muted mt-0.5">{row.sub}</span>
            </button>
          ))}
        </div>

        {/* The "truly private" box belongs to the private option — on
            its own it would mean nothing. It UNFOLDS rather than
            appearing (Luca 2026-09-14: picking private "looks off"):
            it stays in the DOM at zero height and grows, so the form
            never snaps and nothing below it jumps. */}
        <div className={`aux-reveal ${isPrivate ? "aux-reveal-on" : ""}`} inert={!isPrivate}>
          <button
            type="button"
            role="checkbox"
            aria-checked={isHidden}
            tabIndex={isPrivate ? 0 : -1}
            onClick={() => {
              hapticTap();
              setIsHidden(!isHidden);
            }}
            className={`mt-2 w-full text-left p-3 rounded-lg border transition-colors ${
              isHidden ? "border-osd-amber bg-osd-amber/10" : "border-border-medium bg-black/25"
            }`}
          >
            <span
              className={`block text-sm font-bold font-[family-name:var(--font-heading)] ${
                isHidden ? "text-osd-amber" : "text-text-primary"
              }`}
            >
              {isHidden ? "☑ " : "☐ "}
              {t("hidden")}
            </span>
            <span className="block text-xs text-text-muted mt-0.5">
              {isHidden ? t("hiddenOnSub") : t("hiddenOffSub")}
            </span>
          </button>
        </div>
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
