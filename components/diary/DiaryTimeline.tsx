"use client";

/**
 * DiaryTimeline — renders diary entries grouped by month, Letterboxd
 * style: "AUGUST 2026" headers, then one row per listen with cover,
 * title/artist, rating badge, note, relisten icon and the day number.
 *
 * The whole file is a client component so the small edit/delete
 * subcomponents can live alongside the list, but it only takes plain
 * serializable props (entries + isOwner) — server pages render it
 * directly, e.g. <DiaryTimeline entries={entries} isOwner />.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DiaryEntry } from "@/lib/types/database";

/** Same rating color ramp used across the review UI. */
function getRatingColor(rating: number): string {
  if (rating >= 9) return "#a855f7";
  if (rating >= 8) return "#22c55e";
  if (rating >= 7) return "#84cc16";
  if (rating >= 6) return "#eab308";
  if (rating >= 5) return "#f97316";
  if (rating >= 4) return "#ef4444";
  return "#dc2626";
}

/** "2026-08-07" -> "AUGUST 2026" (noon time avoids timezone day-shift). */
function monthHeader(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();
}

/** Day-of-month for the left column, e.g. "07". */
function dayOfMonth(dateStr: string): string {
  return dateStr.slice(8, 10);
}

/** Today's local date as YYYY-MM-DD (for the edit form's max date). */
function localToday(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 10);
}

interface DiaryTimelineProps {
  entries: DiaryEntry[];
  /** Owner-only affordances (edit/delete) render when true. */
  isOwner?: boolean;
}

export default function DiaryTimeline({
  entries,
  isOwner = false,
}: DiaryTimelineProps) {
  // Empty state — keep it friendly, the diary is the fun part.
  if (entries.length === 0) {
    return (
      <div className="panel-xbox p-8 text-center">
        <p className="font-[family-name:var(--font-vt323)] text-xl text-[#5a5a60]">
          Nothing logged yet. Hit &quot;Log a Listen&quot; to start your diary!
        </p>
      </div>
    );
  }

  // Group entries into ordered [monthLabel, entries[]] buckets.
  // The entries arrive sorted newest-first, so insertion order of the
  // Map already matches display order — no re-sorting needed.
  const groups = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const label = monthHeader(entry.listened_on);
    const bucket = groups.get(label);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(label, [entry]);
    }
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([label, monthEntries]) => (
        <section key={label} className="space-y-3">
          {/* Month header, e.g. "AUGUST 2026" */}
          <h2 className="pixel-text text-xs uppercase tracking-widest text-accent-primary">
            {label}
          </h2>

          <div className="space-y-2">
            {monthEntries.map((entry) => (
              <DiaryEntryRow key={entry.id} entry={entry} isOwner={isOwner} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ============================================
   Single diary row — display mode + (owner-only) inline edit mode.
   ============================================ */

function DiaryEntryRow({
  entry,
  isOwner,
}: {
  entry: DiaryEntry;
  isOwner: boolean;
}) {
  const [editing, setEditing] = useState(false);

  // Editing swaps the row for a small inline form.
  if (editing) {
    return <EditEntryForm entry={entry} onClose={() => setEditing(false)} />;
  }

  const ratingColor = entry.rating !== null ? getRatingColor(entry.rating) : null;

  return (
    <article className="card-y2k p-3 sm:p-4 flex gap-3 sm:gap-4 items-start">
      {/* Day of month — the timeline's "date rail" */}
      <div className="w-8 shrink-0 text-center">
        <span className="font-[family-name:var(--font-vt323)] text-2xl text-[#5a5a60] leading-none">
          {dayOfMonth(entry.listened_on)}
        </span>
      </div>

      {/* Cover thumbnail (or a little music-note placeholder) */}
      {entry.cover_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.cover_image}
          alt={`${entry.title} cover`}
          className="w-14 h-14 rounded-lg object-cover border border-white/10 shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-bg-elevated border border-white/10 flex items-center justify-center shrink-0">
          <span className="text-xl" aria-hidden>
            💿
          </span>
        </div>
      )}

      {/* Main content: title/artist, note, owner actions */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-[family-name:var(--font-heading)] font-bold text-[#e8e6e3] truncate">
              {entry.title}
              {/* Relisten marker — Letterboxd's "rewatch" arrows */}
              {entry.is_relisten && (
                <span
                  className="ml-2 text-accent-primary"
                  title="Relisten"
                  aria-label="Relisten"
                >
                  ↻
                </span>
              )}
            </h3>
            <p className="font-[family-name:var(--font-vt323)] text-[#9a9a9e] text-sm truncate">
              {entry.artist}
            </p>
          </div>

          {/* Rating badge — same look as review ratings; hidden if unrated */}
          {entry.rating !== null && ratingColor && (
            <div
              className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold font-[family-name:var(--font-heading)]"
              style={{
                background: `${ratingColor}15`,
                border: `2px solid ${ratingColor}`,
                color: ratingColor,
              }}
            >
              {entry.rating}
            </div>
          )}
        </div>

        {/* Optional short note */}
        {entry.note && (
          <p className="text-sm text-[#9a9a9e] mt-1.5 leading-relaxed">
            {entry.note}
          </p>
        )}

        {/* Owner-only actions */}
        {isOwner && (
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-accent-primary hover:bg-accent-primary/10 transition-colors font-[family-name:var(--font-heading)]"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit
            </button>
            <DeleteEntryButton entryId={entry.id} entryTitle={entry.title} />
          </div>
        )}
      </div>
    </article>
  );
}

/* ============================================
   Inline edit form (owner only) — PATCHes the lightweight fields:
   date, rating, note, relisten. Title/artist stay as logged.
   ============================================ */

function EditEntryForm({
  entry,
  onClose,
}: {
  entry: DiaryEntry;
  onClose: () => void;
}) {
  const router = useRouter();

  // Pre-fill with the entry's current values. Rating is a string so
  // it can be cleared (empty = remove the rating).
  const [listenedOn, setListenedOn] = useState(entry.listened_on);
  const [rating, setRating] = useState(
    entry.rating !== null ? String(entry.rating) : ""
  );
  const [note, setNote] = useState(entry.note ?? "");
  const [isRelisten, setIsRelisten] = useState(entry.is_relisten);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    // Empty rating clears it (null); otherwise validate the number.
    let ratingValue: number | null = null;
    if (rating.trim() !== "") {
      const parsed = parseFloat(rating);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 10) {
        setError("Rating must be between 0.0 and 10.0.");
        return;
      }
      ratingValue = Math.round(parsed * 10) / 10;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/diary/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listened_on: listenedOn,
          rating: ratingValue,
          note: note.trim() || null,
          is_relisten: isRelisten,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save changes.");
        setSaving(false);
        return;
      }

      // Refresh the server-rendered page data, then leave edit mode.
      router.refresh();
      onClose();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="card-y2k p-4 space-y-3">
      {/* Which entry we're editing */}
      <p className="font-[family-name:var(--font-heading)] font-bold text-[#e8e6e3]">
        Editing: {entry.title}{" "}
        <span className="font-[family-name:var(--font-vt323)] font-normal text-[#9a9a9e]">
          by {entry.artist}
        </span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="label-xbox block">Listened on</label>
          <input
            type="date"
            value={listenedOn}
            max={localToday()}
            onChange={(e) => setListenedOn(e.target.value)}
            className="form-input"
          />
        </div>
        <div className="space-y-1.5">
          <label className="label-xbox block">
            Rating <span className="text-[#5a5a60]">(blank = none)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={10}
            step={0.1}
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            placeholder="—"
            className="form-input"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="label-xbox block">
          Note <span className="text-[#5a5a60]">({note.length}/500)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          rows={2}
          maxLength={500}
          className="form-input resize-none"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isRelisten}
          onChange={(e) => setIsRelisten(e.target.checked)}
          className="w-4 h-4 accent-[#1e90ff]"
        />
        <span className="font-[family-name:var(--font-vt323)] text-[#9a9a9e]">
          <span aria-hidden>↻</span> I&apos;ve listened to this before
        </span>
      </label>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-y2k btn-y2k-primary disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="btn-y2k btn-y2k-outline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ============================================
   Delete button with a two-step inline confirm
   (same pattern as DeleteReviewButton).
   ============================================ */

function DeleteEntryButton({
  entryId,
  entryTitle,
}: {
  entryId: string;
  entryTitle: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/diary/${entryId}`, { method: "DELETE" });
      if (res.ok) {
        // Re-fetch server data so the row disappears from the timeline.
        router.refresh();
      }
    } catch {
      // network hiccup — the row simply stays; user can retry
    }
    setDeleting(false);
    setConfirming(false);
  }

  // Step 2: "are you sure?" inline confirm.
  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className="text-xs text-[#9a9a9e] font-[family-name:var(--font-vt323)]">
          Delete &quot;{entryTitle}&quot;?
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-2 py-0.5 rounded text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors font-[family-name:var(--font-heading)] uppercase tracking-wider disabled:opacity-50"
        >
          {deleting ? "..." : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2 py-0.5 rounded text-xs font-bold text-[#9a9a9e] hover:text-[#e8e6e3] transition-colors font-[family-name:var(--font-heading)] uppercase tracking-wider"
        >
          No
        </button>
      </div>
    );
  }

  // Step 1: the plain delete affordance.
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
      Delete
    </button>
  );
}
