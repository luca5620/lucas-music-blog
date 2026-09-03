"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import ReportButton from "@/components/moderation/ReportButton";
import Link from "next/link";
import { hapticTap } from "@/lib/native";
import { useLikeState } from "@/lib/likeStore";
import { useLocale, useTranslations } from "next-intl";

/* ─── Types ─── */

interface CommentProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface CommentData {
  id: string;
  user_id: string;
  review_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  profiles: CommentProfile | null;
}

/** Throw the server's message so the calling form can show it — a
    rejection (content filter, rate limit) must never fail silently.
    Module-level because both the inline forms here AND the taste
    broadcast's CallerComposer (via the `post` ref handle) need it. */
async function throwServerError(res: Response, fallback: string): Promise<never> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(data.error ?? fallback);
}

/* ─── Time Ago Utility ─── */

/** LANGUAGES: `tc` = the "common" translator (justNow / minsAgo / …). */
type Tc = ReturnType<typeof useTranslations<"common">>;
function timeAgo(dateString: string, tc: Tc, locale: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return tc("justNow");
  if (diffMin < 60) return tc("minsAgo", { n: diffMin });
  if (diffHr < 24) return tc("hoursAgo", { n: diffHr });
  if (diffDay < 7) return tc("daysAgo", { n: diffDay });

  const date = new Date(dateString);
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

/* ─── Avatar Component ─── */

function Avatar({
  profile,
  size = "sm",
}: {
  profile: CommentProfile | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "w-9 h-9" : "w-7 h-7";
  const textSize = size === "md" ? "text-sm" : "text-xs";
  const initial = (
    profile?.display_name ||
    profile?.username ||
    "?"
  ).charAt(0).toUpperCase();

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.display_name || profile.username}
        className={`${sizeClass} rounded-full object-cover border border-white/10 shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center shrink-0`}
    >
      <span className={`${textSize} font-bold text-accent-primary uppercase`}>
        {initial}
      </span>
    </div>
  );
}

/* ─── Comment Form ─── */

function CommentForm({
  onSubmit,
  placeholder,
  initialValue = "",
  submitLabel,
  onCancel,
  autoFocus = false,
}: {
  onSubmit: (content: string) => Promise<void>;
  placeholder: string;
  initialValue?: string;
  submitLabel?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [content, setContent] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  // Server rejections (content filter, length, rate limit) surface
  // here — the text stays in the box so nothing typed is lost.
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = useTranslations("comments");
  const tc = useTranslations("common");

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(content.trim());
      setContent("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("couldntPost")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-4 py-3 rounded-lg bg-bg-elevated border border-border-subtle text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/25 transition-all resize-none"
      />
      {error && (
        <p className="text-xs text-accent-rose border border-accent-rose/30 bg-accent-rose/5 rounded px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase text-text-muted hover:text-text-primary border border-border-subtle hover:border-border-medium transition-all font-[family-name:var(--font-heading)]"
          >
            {tc("cancel")}
          </button>
        )}
        <button
          type="submit"
          disabled={!content.trim() || submitting}
          className="px-5 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase bg-accent-primary/15 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/25 transition-all font-[family-name:var(--font-heading)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "..." : (submitLabel ?? t("post"))}
        </button>
      </div>
    </form>
  );
}

/* ─── Comment Like Button ─── */

/**
 * The universal heart on a comment (Luca 2026-08-31 — you couldn't
 * like review comments at all). Same optimistic pattern + shared
 * likeStore as LikeButton, hitting /api/comments/[id]/like.
 */
function CommentLikeButton({
  commentId,
  initialCount,
  initialLiked,
}: {
  commentId: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const { liked, count, write } = useLikeState(
    "comment",
    commentId,
    initialLiked,
    initialCount
  );
  const [pending, setPending] = useState(false);
  const t = useTranslations("comments");

  const handleClick = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (pending) return;
    hapticTap();

    const prevLiked = liked;
    const prevCount = count;
    write({ liked: !prevLiked, count: prevCount + (prevLiked ? -1 : 1) });
    setPending(true);
    try {
      const res = await fetch(`/api/comments/${commentId}/like`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("like failed");
      const data = (await res.json()) as { liked: boolean; count: number };
      write({ liked: data.liked, count: data.count });
    } catch {
      write({ liked: prevLiked, count: prevCount });
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={liked ? t("unlikeComment") : t("likeComment")}
      aria-pressed={liked}
      className={`inline-flex items-center gap-1 ${
        liked ? "text-[#ff4d6d]" : "text-text-muted hover:text-[#ff4d6d]"
      } transition-colors select-none`}
    >
      <svg
        width={13}
        height={13}
        viewBox="0 0 24 24"
        fill={liked ? "#ff4d6d" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          liked
            ? { filter: "drop-shadow(0 0 4px rgba(255,77,109,0.7))" }
            : undefined
        }
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {count > 0 && (
        <span className="font-[family-name:var(--font-heading)] font-bold text-[0.65rem] tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

/* ─── Single Comment ─── */

function CommentItem({
  comment,
  currentUserId,
  isStaff = false,
  onReply,
  onEdit,
  onDelete,
  isReply = false,
  sheetMode = false,
  like,
}: {
  comment: CommentData;
  currentUserId: string | null;
  /** owner/admin viewer — may delete ANY comment (moderation). */
  isStaff?: boolean;
  onReply: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  isReply?: boolean;
  /** Like state for this comment — undefined pre-migration-030 (the
      heart simply doesn't render then). */
  like?: { count: number; mine: boolean };
  /** Rendered inside the taste broadcast's Switchboard read sheet —
      which is only keyboard-safe because it contains ZERO inputs
      (see SwitchboardSheet). So sheet mode hides the Edit button:
      an inline edit form would put a textarea inside the fixed
      sheet and reintroduce the exact iOS keyboard drift the
      read/write split exists to kill. Editing still lives on the
      review page itself. */
  sheetMode?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const t = useTranslations("comments");
  const tc = useTranslations("common");
  const locale = useLocale();
  const isOwn = currentUserId === comment.user_id;
  const displayName =
    comment.profiles?.display_name || comment.profiles?.username || t("unknown");
  const wasEdited = comment.updated_at !== comment.created_at;

  const handleEdit = async (content: string) => {
    await onEdit(comment.id, content);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (deleting) return;
    // Removing someone ELSE's words is a moderation act — never let it
    // happen on an accidental tap. Your own delete stays one-tap.
    if (!isOwn && !window.confirm(t("confirmDelete", { name: displayName }))) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={`flex gap-3 ${isReply ? "ml-10 pl-4 border-l-2 border-accent-primary/15" : ""}`}
    >
      <Avatar profile={comment.profiles} size={isReply ? "sm" : "md"} />
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/profile/${comment.profiles?.username || ""}`}
            className="text-sm font-bold text-text-primary hover:text-accent-primary transition-colors font-[family-name:var(--font-heading)]"
          >
            {displayName}
          </Link>
          <span className="text-xs text-text-muted">
            {timeAgo(comment.created_at, tc, locale)}
          </span>
          {wasEdited && (
            <span className="text-xs text-text-muted italic">{t("edited")}</span>
          )}
        </div>

        {/* Content or Edit Form */}
        {editing ? (
          <div className="mt-2">
            <CommentForm
              onSubmit={handleEdit}
              placeholder={t("editPlaceholder")}
              initialValue={comment.content}
              submitLabel={t("save")}
              onCancel={() => setEditing(false)}
              autoFocus
            />
          </div>
        ) : (
          <p className="text-sm text-text-secondary leading-relaxed mt-1 whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        )}

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-3 mt-2">
            {like && (
              <CommentLikeButton
                commentId={comment.id}
                initialCount={like.count}
                initialLiked={like.mine}
              />
            )}
            {currentUserId && !isReply && (
              <button
                onClick={() => onReply(comment.id)}
                className="pixel-text text-[0.6rem] uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors"
              >
                {t("reply")}
              </button>
            )}
            {isOwn && !sheetMode && (
              <button
                onClick={() => setEditing(true)}
                className="pixel-text text-[0.6rem] uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors"
              >
                {tc("edit")}
              </button>
            )}
            {/* Delete: your own comment, or any comment as staff —
                the staff-on-others case is labeled MOD DELETE so a
                moderation act never masquerades as a personal one. */}
            {(isOwn || isStaff) && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="pixel-text text-[0.6rem] uppercase tracking-widest text-text-muted hover:text-accent-rose transition-colors disabled:opacity-40"
              >
                {deleting ? "..." : isOwn ? tc("delete") : t("modDelete")}
              </button>
            )}
            {/* You can't report yourself — everyone else's comments get a flag. */}
            {!isOwn && (
              <ReportButton targetType="comment" targetId={comment.id} small />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main CommentsSection ─── */

/** Imperative surface for the taste broadcast's CallerComposer: the
    composer lives in a separate fixed top sheet (keyboard-safe by
    construction) but posts THROUGH this section so there's exactly
    one comments write path in the codebase. */
export interface CommentsSectionHandle {
  /** POST a comment/reply and insert the server-confirmed row into
      the local list (no refetch). Throws the server's message on
      rejection so the composer can show it. */
  post: (content: string, parentId: string | null) => Promise<void>;
}

interface CommentsSectionProps {
  reviewId: string;
  /** "default" — the review page's full panel (chrome + header +
      its own CommentForm + inline reply forms). Unchanged.
      "sheet" — the READ half of the taste broadcast's Switchboard
      (WP9): no panel-xbox chrome, no duplicate header, NO forms and
      no autoFocus anywhere — the sheet it sits in is absolutely
      positioned inside `.surf-fullscreen`, which only works because
      the keyboard can never open there. Reply taps are delegated
      UP via onRequestReply instead of opening an inline form. */
  variant?: "default" | "sheet";
  /** Sheet variant: live visible-comment count, reported up because
      the Switchboard's "CALLERS ON THE LINE · n" header renders
      outside this component. */
  onCountChange?: (n: number) => void;
  /** Sheet variant: a Reply tap hands the parent-comment context to
      the caller (which opens the CallerComposer) instead of
      rendering a form here. */
  onRequestReply?: (ctx: {
    parentId: string;
    replyToName: string;
    quote: string;
  }) => void;
}

const CommentsSection = forwardRef<CommentsSectionHandle, CommentsSectionProps>(
  function CommentsSection(
    { reviewId, variant = "default", onCountChange, onRequestReply },
    ref
  ) {
  const sheet = variant === "sheet";
  const t = useTranslations("comments");
  const { user, profile, loading: authLoading } = useAuth();
  // Staff can mod-delete any comment (backed by 007's RLS policy +
  // the role re-check in the DELETE route — this flag is UI only).
  const isStaff = profile?.role === "owner" || profile?.role === "admin";
  const [comments, setComments] = useState<CommentData[]>([]);
  // Starts true only when there's a database to load from —
  // isSupabaseConfigured() is a build-time env check, identical on
  // server and client, so this can't cause a hydration mismatch.
  const [loading, setLoading] = useState(() => isSupabaseConfigured());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  // Authors this viewer has blocked — their comments are hidden.
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  // Per-comment like state (count + whether the viewer liked it).
  // null until migration 030's table answers — hearts hidden till then.
  const [likes, setLikes] = useState<Map<
    string,
    { count: number; mine: boolean }
  > | null>(null);
  const supabaseRef = useRef(createClient());

  // Load the viewer's block list once they're known. Failure is
  // harmless (nothing gets hidden) so errors are swallowed. Logged
  // out, the list is simply not consulted (see `visible` below), so
  // there's nothing to reset here.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/blocks")
      .then((res) => (res.ok ? res.json() : { blocked: [] }))
      .then((data: { blocked?: string[] }) => {
        if (!cancelled) setBlockedIds(new Set(data.blocked ?? []));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Pure loader: fetches the comments (+ like counts) and RETURNS
  // them — no state writes in here. fetchComments below applies the
  // result inside a .then callback, which keeps it plain to the React
  // Compiler lint that the writes run after the network answers,
  // never synchronously inside the effect that kicks the load off.
  // Returns null when the comments query fails (state left as is).
  const loadComments = useCallback(async (): Promise<{
    comments: CommentData[];
    /** null = the likes table didn't answer → leave `likes` alone. */
    likes: Map<string, { count: number; mine: boolean }> | null;
  } | null> => {
    const supabase = supabaseRef.current;
    const { data, error } = await supabase
      .from("comments")
      .select(
        "id, user_id, review_id, parent_id, content, created_at, updated_at, profiles(username, display_name, avatar_url)"
      )
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      return null;
    }
    const rows = (data as unknown as CommentData[]) ?? [];

    // Like counts + the viewer's hearts, one query (RLS: world-
    // readable). Errors — most importantly "relation does not
    // exist" before migration 030 runs — leave `likes` null and no
    // heart renders anywhere. Viewer id read directly from the
    // auth session so this doesn't depend on the auth hook's
    // timing.
    if (rows.length === 0) return { comments: rows, likes: new Map() };

    const { data: likeRows, error: likeError } = await supabase
      .from("comment_likes")
      .select("comment_id, user_id")
      .in(
        "comment_id",
        rows.map((r) => r.id)
      );
    if (likeError || !likeRows) return { comments: rows, likes: null };

    const {
      data: { user: viewer },
    } = await supabase.auth.getUser();
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const row of likeRows as {
      comment_id: string;
      user_id: string;
    }[]) {
      const entry = map.get(row.comment_id) ?? {
        count: 0,
        mine: false,
      };
      entry.count += 1;
      if (viewer && row.user_id === viewer.id) entry.mine = true;
      map.set(row.comment_id, entry);
    }
    return { comments: rows, likes: map };
  }, [reviewId]);

  const fetchComments = useCallback(() => {
    // No database configured → `loading` already started false.
    if (!isSupabaseConfigured()) return Promise.resolve();
    return loadComments().then((result) => {
      if (result) {
        setComments(result.comments);
        if (result.likes) setLikes(result.likes);
      }
      setLoading(false);
    });
  }, [loadComments]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  /* ─── Handlers ─── */

  const handlePost = async (content: string) => {
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, content }),
    });
    if (!res.ok) await throwServerError(res, t("couldntPostComment"));
    await fetchComments();
  };

  const handleReply = async (parentId: string, content: string) => {
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, content, parentId }),
    });
    if (!res.ok) await throwServerError(res, t("couldntPostReply"));
    setReplyingTo(null);
    await fetchComments();
  };

  const handleEdit = async (commentId: string, content: string) => {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) await throwServerError(res, t("couldntSaveEdit"));
    await fetchComments();
  };

  /** The CallerComposer's submit path (exposed via ref): the SAME
      endpoint handlePost/handleReply hit, but on success the
      route's 201 response — the created row WITH its profiles join
      — is inserted straight into local state instead of refetching
      the whole thread. The comment must be visible the instant the
      composer closes (it closes itself right after this resolves),
      and a refetch round-trip would leave a beat of "where did my
      comment go?". */
  const postAndInsert = useCallback(
    async (content: string, parentId: string | null) => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          parentId ? { reviewId, content, parentId } : { reviewId, content }
        ),
      });
      if (!res.ok) await throwServerError(res, t("couldntPostComment"));
      const created = (await res.json()) as CommentData;
      // created_at-ascending order means appending keeps the list
      // sorted; replies are re-grouped under their parent by the
      // threading pass below regardless of array position.
      setComments((prev) => [...prev, created]);
    },
    [reviewId, t]
  );

  useImperativeHandle(ref, () => ({ post: postAndInsert }), [postAndInsert]);

  const handleDelete = async (commentId: string) => {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await fetchComments();
    }
  };

  /* ─── Organize into threads (1 level deep) ───
     Comments from blocked authors are dropped before threading, so
     their replies-to-others also vanish for this viewer. */

  // Block list only applies to a signed-in viewer (a stale list from
  // a previous session is ignored once they're logged out).
  const visible = comments.filter((c) => !user || !blockedIds.has(c.user_id));
  const topLevel = visible.filter((c) => !c.parent_id);
  const repliesMap = new Map<string, CommentData[]>();
  visible
    .filter((c) => c.parent_id)
    .forEach((c) => {
      const list = repliesMap.get(c.parent_id!) ?? [];
      list.push(c);
      repliesMap.set(c.parent_id!, list);
    });

  const commentCount = visible.length;

  // Sheet variant: report the live VISIBLE count up (post-block-
  // filter, so the Switchboard header never counts hidden authors).
  // An effect, not a render call — setting parent state during a
  // child's render is a React error.
  useEffect(() => {
    if (!loading) onCountChange?.(commentCount);
  }, [loading, commentCount, onCountChange]);

  /* ─── Render ─── */

  return (
    // Sheet variant sheds the panel chrome — the Switchboard sheet
    // provides its own surface, header and WRITE affordance.
    <div className={sheet ? "space-y-5" : "panel-xbox p-4 sm:p-6 space-y-5"}>
      {/* Header — default only (the sheet has "CALLERS ON THE LINE") */}
      {!sheet && (
        <>
          <div className="flex items-center gap-2">
            <span className="glow-orb" />
            <span className="label-xbox">{t("title")}</span>
            <span className="text-xs text-text-muted ml-1">
              ({loading ? "--" : commentCount})
            </span>
          </div>

          <div className="divider-glow" />
        </>
      )}

      {/* New Comment Form or Sign In Prompt — default only. The
          sheet variant renders NO form at all: writing happens in
          the CallerComposer (its own keyboard-safe top sheet). */}
      {sheet ? null : authLoading ? null : user ? (
        <CommentForm
          onSubmit={handlePost}
          placeholder={t("dropPlaceholder")}
        />
      ) : (
        <div className="card-y2k p-4 text-center">
          <p className="text-sm text-text-muted">
            {t.rich("toComment", {
              a: (chunks) => (
                <Link
                  href="/login"
                  className="text-accent-primary hover:text-accent-glow transition-colors font-bold"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="text-center py-8">
          <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
            {t("loading")}
          </span>
        </div>
      ) : commentCount === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-text-muted">
            {t("none")}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {topLevel.map((comment) => (
            <div key={comment.id} className="space-y-4">
              <CommentItem
                comment={comment}
                currentUserId={user?.id ?? null}
                isStaff={isStaff}
                sheetMode={sheet}
                like={
                  likes
                    ? (likes.get(comment.id) ?? { count: 0, mine: false })
                    : undefined
                }
                onReply={(id) => {
                  if (sheet) {
                    // Switchboard: no inline form — hand the parent
                    // context up so the CallerComposer opens with
                    // the quoted comment ("REPLYING TO …").
                    onRequestReply?.({
                      parentId: id,
                      replyToName:
                        comment.profiles?.display_name ||
                        comment.profiles?.username ||
                        t("unknown"),
                      quote: comment.content,
                    });
                  } else {
                    setReplyingTo(replyingTo === id ? null : id);
                  }
                }}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />

              {/* Reply Form — default only (sheet replies go through
                  the CallerComposer, never an inline textarea) */}
              {!sheet && replyingTo === comment.id && user && (
                <div className="ml-10 pl-4 border-l-2 border-accent-primary/15">
                  <CommentForm
                    onSubmit={(content) => handleReply(comment.id, content)}
                    placeholder={t("replyTo", {
                      name: comment.profiles?.display_name || comment.profiles?.username || t("user"),
                    })}
                    submitLabel={t("reply")}
                    onCancel={() => setReplyingTo(null)}
                    autoFocus
                  />
                </div>
              )}

              {/* Threaded Replies */}
              {repliesMap.get(comment.id)?.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={user?.id ?? null}
                  isStaff={isStaff}
                  sheetMode={sheet}
                  like={
                    likes
                      ? (likes.get(reply.id) ?? { count: 0, mine: false })
                      : undefined
                  }
                  onReply={() => {}}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isReply
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
  }
);

export default CommentsSection;
