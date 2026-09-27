"use client";

/**
 * DockedRoomChat — a release's LIVE ROOM inside Your Taste's docked
 * panel (Luca 2026-09-27: "on releases can you have the live chat
 * there"). Reviews show their comment thread in that panel; release
 * cards show the release's live chat instead, so you can sit in the
 * room without leaving the channel.
 *
 * The release page loads the room server-side; here the card changes
 * as you surf, so this fetches the same bundle in the browser
 * (GET /api/rooms/<id>/messages?bootstrap=1) and then mounts the
 * ordinary ChatPanel — same realtime, reactions and composer as the
 * release page. The parent keys this by release id, so surfing to
 * another release unmounts the old room (and its realtime channel)
 * before the next one mounts: ChatPanel must only ever be mounted
 * once per room (duplicate channel topics silently no-op).
 *
 * That GET never creates a room (anonymous reads mustn't). A release
 * nobody has opened yet has no room, so we point to its page, where
 * the room gets made.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import ChatPanel, {
  type ChatMessageWithProfile,
} from "@/components/rooms/ChatPanel";
import ShimmerLines from "@/components/ui/ShimmerLines";
import type {
  ReactionCountRow,
  ViewerReactionRow,
} from "@/components/chat/useMessageReactions";
import type { ReleaseRoom } from "@/lib/types/database";

type Bundle = {
  room: ReleaseRoom | null;
  messages: ChatMessageWithProfile[];
  reactionCounts?: ReactionCountRow[];
  viewerReactions?: ViewerReactionRow[];
};

export default function DockedRoomChat({
  releaseId,
  releaseSlug,
  accentColor,
}: {
  releaseId: string;
  releaseSlug: string;
  accentColor: string;
}) {
  const t = useTranslations("taste.surf");
  // undefined = loading, null = failed, Bundle = ready. The parent
  // remounts us per release (key), so there's no stale bundle to clear.
  const [bundle, setBundle] = useState<Bundle | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rooms/${releaseId}/messages?bootstrap=1`)
      .then((r) => (r.ok ? (r.json() as Promise<Bundle>) : null))
      .catch(() => null)
      .then((b) => {
        if (!cancelled) setBundle(b);
      });
    return () => {
      cancelled = true;
    };
  }, [releaseId]);

  if (bundle === undefined) {
    return (
      <div className="p-4">
        <ShimmerLines lines={6} />
      </div>
    );
  }

  // No room yet (or the fetch failed): the release page opens one.
  if (!bundle || !bundle.room) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="pixel-text text-[11px] uppercase tracking-widest text-text-muted leading-relaxed">
          {t("dockNoRoom")}
        </p>
        <Link
          href={`/releases/${releaseSlug}`}
          className="pixel-text text-[11px] uppercase tracking-widest text-accent-primary hover:text-accent-glow transition-colors"
        >
          {t("dockOpenRoom")}
        </Link>
      </div>
    );
  }

  return (
    <ChatPanel
      releaseId={releaseId}
      initialMessages={bundle.messages}
      initialRoom={bundle.room}
      accentColor={accentColor}
      initialReactionCounts={bundle.reactionCounts ?? []}
      initialViewerReactions={bundle.viewerReactions ?? []}
      // "sheet" = no panel border, and the message list flexes to our
      // height instead of the release page's fixed column height.
      variant="sheet"
    />
  );
}
