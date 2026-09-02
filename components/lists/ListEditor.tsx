"use client";

/**
 * ListEditor — create/edit form for a user list.
 *
 * Handles:
 * - list metadata (title, description, ranked + public toggles)
 * - adding releases via CatalogSearch (local + Spotify + Genius —
 *   items can ONLY come from the catalog, no free-text entry)
 * - a per-item note field, remove button, and up/down reorder buttons
 *
 * Item edits are held in local state and persisted all at once when
 * the user hits Save:
 *   create mode: POST the list, then POST each item.
 *   edit mode:   PATCH the list, DELETE removed items, POST new
 *                items, PATCH changed notes, then send one reorder
 *                call so positions match what's on screen.
 * On success we navigate to the list's public page.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { List, ListItem } from "@/lib/types/database";
import CatalogSearch, {
  type CatalogPick,
} from "@/components/catalog/CatalogSearch";

/**
 * An item row as the editor sees it. Saved items carry their database
 * id; freshly-added ones have id: null until we POST them. localId is
 * a stable client-side key for React (never sent to the server).
 *
 * title/artist/cover_image are display-only copies — the server
 * re-derives them from release_id on save, so nothing here can be
 * forged into the database.
 */
interface EditorItem {
  localId: string;
  id: string | null;
  release_id: string | null;
  title: string;
  artist: string;
  cover_image: string | null;
  note: string;
}

interface ListEditorProps {
  mode: "create" | "edit";
  /** The owner's username — used to build the redirect URL after save. */
  username: string;
  /** Existing list + items (edit mode only). */
  list?: List;
  initialItems?: ListItem[];
}

let nextLocalId = 0;
function makeLocalId(): string {
  nextLocalId += 1;
  return `local-${nextLocalId}`;
}

export default function ListEditor({
  mode,
  username,
  list,
  initialItems,
}: ListEditorProps) {
  const router = useRouter();

  // --- List metadata state ---
  const [title, setTitle] = useState(list?.title ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [isRanked, setIsRanked] = useState(list?.is_ranked ?? false);
  const [isPublic, setIsPublic] = useState(list?.is_public ?? true);

  // --- Item rows (already sorted by position when passed in) ---
  const [items, setItems] = useState<EditorItem[]>(() =>
    (initialItems ?? []).map((item) => ({
      localId: makeLocalId(),
      id: item.id,
      release_id: item.release_id,
      title: item.title,
      artist: item.artist,
      cover_image: item.cover_image,
      note: item.note ?? "",
    }))
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* --- Item row operations --- */

  // Catalog pick → append a new row at the end. The picker has
  // already imported the release, so we get a real local row back
  // with a guaranteed release.id.
  const handleAddRelease = useCallback((picked: CatalogPick) => {
    setItems((prev) => [
      ...prev,
      {
        localId: makeLocalId(),
        id: null,
        release_id: picked.release.id,
        title: picked.release.title,
        artist: picked.artist_name || "Unknown Artist",
        cover_image: picked.release.cover_image,
        note: "",
      },
    ]);
  }, []);

  const removeItem = useCallback((localId: string) => {
    setItems((prev) => prev.filter((i) => i.localId !== localId));
  }, []);

  const updateNote = useCallback((localId: string, note: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.localId === localId ? { ...i, note: note.slice(0, 500) } : i
      )
    );
  }, []);

  // Swap an item with its neighbor. direction -1 = up, +1 = down.
  const moveItem = useCallback((localId: string, direction: -1 | 1) => {
    setItems((prev) => {
      const index = prev.findIndex((i) => i.localId === localId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  /* --- Save --- */

  // asDraft=true is the Save as Draft path (Luca 2026-08-26: every
  // create form gets the reviews-style draft button). Lists already
  // had drafts in all but name — a private list is invisible to
  // everyone but its owner — so drafting just forces is_public off;
  // publish later by re-saving with the Public box ticked.
  async function handleSave(asDraft = false) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Give your list a title.");
      return;
    }
    if (trimmedTitle.length > 120) {
      setError("Title must be 120 characters or fewer.");
      return;
    }
    if (description.trim().length > 2000) {
      setError("Description must be 2000 characters or fewer.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const metaBody = {
        title: trimmedTitle,
        description: description.trim() || null,
        is_ranked: isRanked,
        is_public: asDraft ? false : isPublic,
      };

      if (mode === "create") {
        // 1) Create the list itself. The server generates the slug.
        const res = await fetch("/api/lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metaBody),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create list.");
        }
        const created = (await res.json()) as List;

        // 2) Add each item, in order. Position = its index on screen.
        //    We only send release_id + note — the server pulls the
        //    title/artist/cover straight from the catalog row.
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const itemRes = await fetch(`/api/lists/${created.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              release_id: item.release_id,
              note: item.note.trim() || null,
              position: i,
            }),
          });
          if (!itemRes.ok) {
            const data = await itemRes.json().catch(() => ({}));
            throw new Error(data.error || "Failed to add an item.");
          }
        }

        // 3) Off to the shiny new list page.
        router.push(`/lists/${username}/${created.slug}`);
        router.refresh();
        return;
      }

      // ------- Edit mode -------
      if (!list) throw new Error("Missing list to edit.");

      // 1) Save metadata changes.
      const metaRes = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metaBody),
      });
      if (!metaRes.ok) {
        const data = await metaRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save list.");
      }

      // 2) Delete items that were removed in the editor.
      const keptIds = new Set(
        items.map((i) => i.id).filter((id): id is string => !!id)
      );
      const removed = (initialItems ?? []).filter((i) => !keptIds.has(i.id));
      for (const item of removed) {
        const res = await fetch(`/api/lists/${list.id}/items/${item.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to remove an item.");
      }

      // 3) POST new items / PATCH notes that changed. We collect the
      //    final on-screen order of database ids as we go, so we can
      //    send one reorder call at the end.
      const originalById = new Map((initialItems ?? []).map((i) => [i.id, i]));
      const orderedItemIds: string[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (!item.id) {
          // New item — create it and remember the id we get back.
          // Same slim body as create mode: the catalog is the only
          // source of truth for what this item *is*.
          const res = await fetch(`/api/lists/${list.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              release_id: item.release_id,
              note: item.note.trim() || null,
              position: i,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to add an item.");
          }
          const createdItem = (await res.json()) as ListItem;
          orderedItemIds.push(createdItem.id);
          continue;
        }

        // Existing item — only PATCH if the note actually changed.
        const original = originalById.get(item.id);
        const newNote = item.note.trim() || null;
        if (original && (original.note ?? null) !== newNote) {
          const res = await fetch(`/api/lists/${list.id}/items/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note: newNote }),
          });
          if (!res.ok) throw new Error("Failed to save an item note.");
        }
        orderedItemIds.push(item.id);
      }

      // 4) One reorder call to make positions match the screen.
      if (orderedItemIds.length > 0) {
        const res = await fetch(`/api/lists/${list.id}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedItemIds }),
        });
        if (!res.ok) throw new Error("Failed to reorder items.");
      }

      router.push(`/lists/${username}/${list.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  /* --- Delete the whole list (edit mode only) --- */

  async function handleDeleteList() {
    if (!list) return;
    if (!window.confirm("Delete this list? This cannot be undone.")) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/lists/${list.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete list.");
      router.push("/lists");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* --- Header — same centered module + plain-sentence intro as
          the posts/debates create pages (Luca 2026-08-26: one
          consistent format across the create button's options). --- */}
      <div className="space-y-2">
        <h1 className="crt-title text-3xl sm:text-4xl">
          {mode === "edit" ? "Edit List" : "New List"}
        </h1>
        <p className="text-sm text-text-secondary">
          {mode === "edit"
            ? "Tweak the lineup."
            : "Gather albums into something worth sharing."}
        </p>
      </div>

      {/* --- List details --- */}
      <fieldset className="panel-xbox p-5 space-y-4">
        <legend className="label-xbox">List Details</legend>

        <div className="space-y-1.5">
          <label className="font-[family-name:var(--font-heading)] text-xs font-bold text-[#9a9a9e] uppercase tracking-wider block">
            Title * ({title.length}/120)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="e.g. Best albums of 2026"
            maxLength={120}
            required
            className="form-input"
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-[family-name:var(--font-heading)] text-xs font-bold text-[#9a9a9e] uppercase tracking-wider block">
            Description ({description.length}/2000)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
            placeholder="What ties these together?"
            rows={4}
            maxLength={2000}
            className="form-input resize-none"
          />
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isRanked}
              onChange={(e) => setIsRanked(e.target.checked)}
              className="w-4 h-4 accent-[#1e90ff]"
            />
            <span className="text-sm text-text-secondary">
              Ranked list{" "}
              <span className="text-text-muted">(shows 1, 2, 3… badges)</span>
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 accent-[#1e90ff]"
            />
            <span className="text-sm text-text-secondary">
              Public <span className="text-text-muted">(anyone can view)</span>
            </span>
          </label>
        </div>
      </fieldset>

      {/* --- Items ---
          overflow-visible: hosts the catalog search dropdown, which the
          panel's default overflow:hidden would clip. */}
      <fieldset className="panel-xbox overflow-visible p-5 space-y-4">
        <legend className="label-xbox">Albums ({items.length})</legend>

        {/* Add via the unified catalog picker — local rows, Spotify
            albums, and Genius deep cuts (unreleased included). */}
        <div className="space-y-2">
          <span className="label-xbox block">Add a release</span>
          <CatalogSearch
            onPick={handleAddRelease}
            placeholder="Search any album, EP, single — even unreleased…"
          />
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-text-muted italic">
            Nothing here yet — search above to start stacking albums.
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((item, index) => (
              <li
                key={item.localId}
                className="card-y2k p-3 flex gap-3 items-start"
              >
                {/* Position + reorder buttons */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveItem(item.localId, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className="text-text-muted hover:text-accent-primary disabled:opacity-30 disabled:hover:text-text-muted transition-colors"
                  >
                    ▲
                  </button>
                  <span className="pixel-text text-sm text-text-muted">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveItem(item.localId, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Move down"
                    className="text-text-muted hover:text-accent-primary disabled:opacity-30 disabled:hover:text-text-muted transition-colors"
                  >
                    ▼
                  </button>
                </div>

                {/* Cover */}
                <div className="w-14 h-14 rounded bg-bg-elevated border border-[rgba(255,255,255,0.1)] overflow-hidden shrink-0 flex items-center justify-center">
                  {item.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.cover_image}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-text-muted text-xs">{"//"}</span>
                  )}
                </div>

                {/* Title, artist, note */}
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <div className="text-sm text-[#e8e6e3] font-medium truncate">
                      {item.title}
                    </div>
                    <div className="text-xs text-text-secondary truncate">
                      {item.artist}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={item.note}
                    onChange={(e) => updateNote(item.localId, e.target.value)}
                    placeholder="Add a note (optional)..."
                    maxLength={500}
                    className="form-input text-sm"
                  />
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeItem(item.localId)}
                  title="Remove from list"
                  aria-label={`Remove ${item.title}`}
                  className="mt-1 text-[#5a5a60] hover:text-accent-rose transition-colors shrink-0"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ol>
        )}
      </fieldset>

      {/* --- Error --- */}
      {error && (
        <div className="panel-xbox p-4 border-red-500/30 bg-red-500/5">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* --- Actions --- */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => handleSave()}
          disabled={saving}
          className="btn-y2k btn-y2k-primary disabled:opacity-50"
        >
          {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Create List"}
        </button>

        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={saving}
          className="btn-y2k btn-y2k-outline disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save as Draft"}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          disabled={saving}
          className="btn-y2k btn-y2k-outline disabled:opacity-50"
        >
          Cancel
        </button>

        {/* Desktop only (Luca 2026-09-02): on a phone the red button
            crowded the Save/Cancel row right where thumbs land, and a
            list you just built from a playlist is one mis-tap from
            gone. Deleting stays a big-screen action. */}
        {mode === "edit" && (
          <button
            type="button"
            onClick={handleDeleteList}
            disabled={saving}
            className="btn-y2k btn-y2k-outline disabled:opacity-50 ml-auto text-accent-rose hidden sm:inline-flex"
          >
            Delete List
          </button>
        )}
      </div>
    </div>
  );
}
