"use client";

/**
 * NewDebateForm — open a new two-sided debate, or (edit mode) rework
 * one you already opened.
 *
 * Fields: topic (title), optional framing prompt, the two side
 * labels, and releases picked through CatalogSearch — one per SIDE
 * ("Side A = album X, Side B = album Y", migration 039, Luca
 * 2026-09-02) plus the older whole-debate pin. Never hand-typed
 * metadata: every attachment is a real catalog row.
 *
 * Edit mode (`initial` set): PATCHes /api/debates/[id]. Side LABELS
 * lock once anyone has voted or posted (initial.sidesLocked) — those
 * words are what people argued under. Everything else stays editable,
 * and the floor can be signed off / reopened.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import CatalogSearch, {
  type CatalogPick,
} from "@/components/catalog/CatalogSearch";

/** What an attached release looks like inside the form. */
interface Attached {
  id: string;
  title: string;
  cover_image: string | null;
  artist_name?: string;
}

export interface DebateFormInitial {
  id: string;
  slug: string;
  title: string;
  prompt: string | null;
  side_a_label: string;
  side_b_label: string;
  status: "open" | "closed";
  release: Attached | null;
  side_a_release: Attached | null;
  side_b_release: Attached | null;
  /** true once votes or takes exist — labels can't change any more. */
  sidesLocked: boolean;
}

function fromPick(pick: CatalogPick): Attached {
  return {
    id: pick.release.id,
    title: pick.release.title,
    cover_image: pick.release.cover_image,
    artist_name: pick.artist_name,
  };
}

export default function NewDebateForm({
  initial,
}: {
  initial?: DebateFormInitial;
}) {
  const router = useRouter();
  const editing = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [sideA, setSideA] = useState(initial?.side_a_label ?? "");
  const [sideB, setSideB] = useState(initial?.side_b_label ?? "");
  const [attached, setAttached] = useState<Attached | null>(initial?.release ?? null);
  const [sideARelease, setSideARelease] = useState<Attached | null>(
    initial?.side_a_release ?? null
  );
  const [sideBRelease, setSideBRelease] = useState<Attached | null>(
    initial?.side_b_release ?? null
  );
  const [status, setStatus] = useState<"open" | "closed">(initial?.status ?? "open");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // publish=false is the Save as Draft path (same QoL as reviews and
  // posts): the room is created but only its creator can see it, and a
  // Publish button on the debate page puts it on air later.
  async function submit(publish: boolean) {
    if (submitting) return;
    setError(null);

    // Mirror the server's rules so most mistakes never leave the page.
    if (title.trim().length < 3) {
      setError("Give the topic at least 3 characters.");
      return;
    }
    if (!sideA.trim() || !sideB.trim()) {
      setError("Both sides need a label.");
      return;
    }
    if (sideA.trim().toLowerCase() === sideB.trim().toLowerCase()) {
      setError("The two sides have to actually disagree.");
      return;
    }

    setSubmitting(true);
    try {
      if (editing && initial) {
        const res = await fetch(`/api/debates/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            prompt: prompt.trim() || null,
            // Locked labels aren't sent at all — the server would
            // refuse them, and nothing changed anyway.
            ...(initial.sidesLocked
              ? {}
              : { side_a_label: sideA.trim(), side_b_label: sideB.trim() }),
            release_id: attached?.id ?? null,
            side_a_release_id: sideARelease?.id ?? null,
            side_b_release_id: sideBRelease?.id ?? null,
            status,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Couldn't save the debate.");
        router.push(`/debates/${initial.slug}`);
        router.refresh();
        return;
      }

      const res = await fetch("/api/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          prompt: prompt.trim() || null,
          side_a_label: sideA.trim(),
          side_b_label: sideB.trim(),
          release_id: attached?.id ?? null,
          side_a_release_id: sideARelease?.id ?? null,
          side_b_release_id: sideBRelease?.id ?? null,
          is_published: publish,
        }),
      });
      const data = (await res.json()) as {
        debate?: { slug: string };
        error?: string;
      };
      if (!res.ok || !data.debate) {
        throw new Error(data.error ?? "Couldn't open the debate.");
      }
      router.push(`/debates/${data.debate.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something broke.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(true);
      }}
      className="space-y-5"
    >
      {/* Topic */}
      <div>
        <label className="block text-xs uppercase tracking-widest text-text-muted mb-1.5 font-[family-name:var(--font-heading)]">
          The topic
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          placeholder='e.g. "Is MBDTF overrated?"'
          className="form-input"
          autoFocus={!editing}
        />
        <p className="mt-1 text-[10px] text-text-muted tabular-nums text-right">
          {title.length}/140
        </p>
      </div>

      {/* Optional framing */}
      <div>
        <label className="block text-xs uppercase tracking-widest text-text-muted mb-1.5 font-[family-name:var(--font-heading)]">
          Frame it (optional)
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Set the terms of the argument…"
          className="form-input resize-none"
        />
      </div>

      {/* The two sides — label + optional release each */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SidePanel
          tone="a"
          label={sideA}
          onLabel={setSideA}
          placeholder='e.g. "Classic"'
          locked={!!initial?.sidesLocked}
          release={sideARelease}
          onRelease={setSideARelease}
        />
        <SidePanel
          tone="b"
          label={sideB}
          onLabel={setSideB}
          placeholder='e.g. "Overrated"'
          locked={!!initial?.sidesLocked}
          release={sideBRelease}
          onRelease={setSideBRelease}
        />
      </div>
      {initial?.sidesLocked && (
        <p className="text-xs text-text-muted -mt-2">
          People have already voted or argued under these sides, so the
          labels are locked — the releases, topic and framing can still
          change.
        </p>
      )}

      {/* Optional whole-debate pin (the original attachment) */}
      <div>
        <AttachedChip
          value={attached}
          onClear={() => setAttached(null)}
          picker={
            <CatalogSearch
              label="Pin a release to the whole debate (optional)"
              placeholder="Attach the album/song on trial…"
              onPick={(pick) => setAttached(fromPick(pick))}
            />
          }
        />
      </div>

      {/* Edit-only: sign off / reopen the floor */}
      {editing && (
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest text-text-muted font-[family-name:var(--font-heading)]">
            The floor is
          </span>
          <div className="flex gap-1">
            {(["open", "closed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`tab-y2k ${status === s ? "tab-active" : ""}`}
              >
                {s === "open" ? "ON AIR" : "SIGNED OFF"}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-accent-rose">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="btn-y2k btn-y2k-primary disabled:opacity-50"
        >
          {editing
            ? submitting
              ? "SAVING…"
              : "SAVE CHANGES"
            : submitting
              ? "OPENING…"
              : "OPEN THE FLOOR"}
        </button>

        {!editing && (
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={submitting}
            className="btn-y2k btn-y2k-outline disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save as Draft"}
          </button>
        )}

        <button
          type="button"
          onClick={() => router.back()}
          disabled={submitting}
          className="btn-y2k btn-y2k-outline disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---- One side: its label + its (optional) release ---- */

function SidePanel({
  tone,
  label,
  onLabel,
  placeholder,
  locked,
  release,
  onRelease,
}: {
  tone: "a" | "b";
  label: string;
  onLabel: (v: string) => void;
  placeholder: string;
  locked: boolean;
  release: Attached | null;
  onRelease: (r: Attached | null) => void;
}) {
  const color = tone === "a" ? "text-accent-primary" : "text-accent-rose";
  return (
    <div className="space-y-2">
      <label
        className={`block text-xs uppercase tracking-widest ${color} mb-1.5 font-[family-name:var(--font-heading)]`}
      >
        Side {tone.toUpperCase()}
      </label>
      <input
        type="text"
        value={label}
        onChange={(e) => onLabel(e.target.value)}
        maxLength={40}
        placeholder={placeholder}
        className="form-input disabled:opacity-60"
        disabled={locked}
        title={locked ? "Locked — people already voted under this label" : undefined}
      />
      <AttachedChip
        value={release}
        onClear={() => onRelease(null)}
        compact
        picker={
          <CatalogSearch
            placeholder={`Side ${tone.toUpperCase()}'s record (optional)…`}
            onPick={(pick) => onRelease(fromPick(pick))}
          />
        }
      />
    </div>
  );
}

/* ---- Attached-release chip, or the picker when nothing's attached ---- */

function AttachedChip({
  value,
  onClear,
  picker,
  compact = false,
}: {
  value: Attached | null;
  onClear: () => void;
  picker: React.ReactNode;
  compact?: boolean;
}) {
  if (!value) return <>{picker}</>;
  const size = compact ? "w-10 h-10" : "w-12 h-12";
  return (
    <div className="panel-xbox p-3 flex items-center gap-3">
      <span className={`${size} rounded overflow-hidden border border-border-subtle shrink-0`}>
        {value.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.cover_image} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center">💿</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold truncate">{value.title}</span>
        {value.artist_name && (
          <span className="block text-xs text-text-secondary truncate">
            {value.artist_name}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="text-xs text-accent-rose hover:underline shrink-0"
      >
        detach
      </button>
    </div>
  );
}
