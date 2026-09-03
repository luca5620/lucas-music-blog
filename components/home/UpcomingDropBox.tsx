"use client";

/**
 * UpcomingDropBox — the home page's "paste a Spotify link" slot.
 *
 * Deliberately narrower than CatalogSearch: it takes ONLY Spotify
 * album links, and ONLY albums that haven't dropped yet. Released
 * albums are turned away (that's what search is for) — this box
 * exists purely to open countdown pages + live rooms early.
 *
 * Flow: validate the link shape client-side → resolve it through
 * /api/search/catalog (which reads the album straight from Spotify)
 * → refuse anything already out → import via /api/catalog/ensure →
 * jump to the fresh release page, where the room is already open.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface CatalogResult {
  source: "local" | "spotify" | "spotify_track" | "genius";
  id: string;
  title: string;
  artist: string;
  slug?: string;
  upcoming?: boolean;
}

// Album links only — tracks/playlists/artists don't carry a countdown.
// (/prerelease/ links pass the shape test so the server can answer
// with its "grab the album link instead" explainer.)
const SPOTIFY_LINK =
  /^(https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:album|prerelease)\/[A-Za-z0-9]{10,30}|spotify:album:[A-Za-z0-9]{10,30})/i;

export default function UpcomingDropBox() {
  // LANGUAGES: every message this box shows (messages → "home.dropBox").
  // The server's own `notice` text stays as the API sent it.
  const t = useTranslations("home.dropBox");
  const router = useRouter();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = link.trim();
    setMessage(null);

    if (!SPOTIFY_LINK.test(trimmed)) {
      setMessage(t("albumLinksOnly"));
      return;
    }

    setBusy(true);
    try {
      // Resolve the link server-side (Spotify serves unreleased albums
      // by id even though its search hides them).
      const res = await fetch(
        `/api/search/catalog?q=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) throw new Error("resolve failed");
      const data = (await res.json()) as {
        results: CatalogResult[];
        notice?: string;
      };

      const hit = data.results[0];
      if (!hit) {
        setMessage(data.notice ?? t("cantRead"));
        return;
      }

      // The whole point of this box: future drops only.
      if (!hit.upcoming) {
        setMessage(t("alreadyOut", { title: hit.title }));
        return;
      }

      // Already on PMR? Its page (and room) exists — go there.
      if (hit.source === "local" && hit.slug) {
        router.push(`/releases/${hit.slug}`);
        return;
      }

      const imp = await fetch("/api/catalog/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: hit.source, id: hit.id }),
      });
      const impData = (await imp.json()) as {
        release?: { slug: string };
        error?: string;
      };
      if (!imp.ok || !impData.release) {
        throw new Error(impData.error ?? "import failed");
      }

      router.push(`/releases/${impData.release.slug}`);
    } catch {
      setMessage(t("hiccup"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            if (message) setMessage(null);
          }}
          placeholder={t("placeholder")}
          className="form-input flex-1"
          aria-label={t("ariaLabel")}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || link.trim().length === 0}
          className="btn-y2k btn-y2k-primary shrink-0 disabled:opacity-50"
        >
          {busy ? t("tuning") : t("openRoom")}
        </button>
      </div>
      {message && <p className="text-xs text-osd-amber">{message}</p>}
    </form>
  );
}
