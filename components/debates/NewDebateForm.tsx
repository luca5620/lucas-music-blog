"use client";

/**
 * NewDebateForm — open a new two-sided debate.
 *
 * Fields: topic (title), optional framing prompt, the two side
 * labels, and an optional release attachment picked through
 * CatalogSearch (so even debates are anchored to real catalog
 * entries — never hand-typed metadata).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import CatalogSearch, {
  type CatalogPick,
} from "@/components/catalog/CatalogSearch";

export default function NewDebateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [sideA, setSideA] = useState("");
  const [sideB, setSideB] = useState("");
  const [attached, setAttached] = useState<CatalogPick | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      const res = await fetch("/api/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          prompt: prompt.trim() || null,
          side_a_label: sideA.trim(),
          side_b_label: sideB.trim(),
          release_id: attached?.release.id ?? null,
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
    <form onSubmit={handleSubmit} className="space-y-5">
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
          autoFocus
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

      {/* The two sides */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-widest text-accent-primary mb-1.5 font-[family-name:var(--font-heading)]">
            Side A
          </label>
          <input
            type="text"
            value={sideA}
            onChange={(e) => setSideA(e.target.value)}
            maxLength={40}
            placeholder='e.g. "Classic"'
            className="form-input"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-accent-rose mb-1.5 font-[family-name:var(--font-heading)]">
            Side B
          </label>
          <input
            type="text"
            value={sideB}
            onChange={(e) => setSideB(e.target.value)}
            maxLength={40}
            placeholder='e.g. "Overrated"'
            className="form-input"
          />
        </div>
      </div>

      {/* Optional release attachment */}
      <div>
        {attached ? (
          <div className="panel-xbox p-3 flex items-center gap-3">
            <span className="w-12 h-12 rounded overflow-hidden border border-border-subtle shrink-0">
              {attached.release.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attached.release.cover_image}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center">
                  💿
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold truncate">
                {attached.release.title}
              </span>
              <span className="block text-xs text-text-secondary truncate">
                {attached.artist_name}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setAttached(null)}
              className="text-xs text-accent-rose hover:underline shrink-0"
            >
              detach
            </button>
          </div>
        ) : (
          <CatalogSearch
            label="Pin a release (optional)"
            placeholder="Attach the album/song on trial…"
            onPick={setAttached}
          />
        )}
      </div>

      {error && <p className="text-sm text-accent-rose">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="btn-y2k btn-y2k-primary disabled:opacity-50"
      >
        {submitting ? "OPENING…" : "OPEN THE FLOOR"}
      </button>
    </form>
  );
}
