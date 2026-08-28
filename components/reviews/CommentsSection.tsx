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
import ReportButton from "@/components/moderation/ReportButton";
import Link from "next/link";

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

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  submitLabel = "Post",
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
        err instanceof Error ? err.message : "Couldn't post that — try again."
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
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!content.trim() || submitting}
          className="px-5 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase bg-accent-primary/15 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/25 transition-all font-[family-name:var(--font-heading)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "..." : submitLabel}
        </button>
      </div>
    </form>
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
}: {
  comment: CommentData;
  currentUserId: string | null;
  /** owner/admin viewer — may delete ANY comment (moderation). */
  isStaff?: boolean;
  onReply: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  isReply?: boolean;
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
  const isOwn = currentUserId === comment.user_id;
  const displayName =
    comment.profiles?.display_name || comment.profiles?.username || "Unknown";
  const wasEdited = comment.updated_at !== comment.created_at;

  const handleEdit = async (content: string) => {
    await onEdit(comment.id, content);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (deleting) return;
    // Removing someone ELSE's words is a moderation act — never let it
    // happen on an accidental tap. Your own delete stays one-tap.
    if (!isOwn && !window.confirm(`Delete ${displayName}'s comment?`)) {
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
            {timeAgo(comment.created_at)}
          </span>
          {wasEdited && (
            <span className="text-xs text-text-muted italic">(edited)</span>
          )}
        </div>

        {/* Content or Edit Form */}
        {editing ? (
          <div className="mt-2">
            <CommentForm
              onSubmit={handleEdit}
              placeholder="Edit your comment..."
              initialValue={comment.content}
              submitLabel="Save"
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
            {currentUserId && !isReply && (
              <button
                onClick={() => onReply(comment.id)}
                className="pixel-text text-[0.6rem] uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors"
              >
                Reply
              </button>
            )}
            {isOwn && !sheetMode && (
              <button
                onClick={() => setEditing(true)}
                className="pixel-text text-[0.6rem] uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors"
              >
                Edit
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
                {deleting ? "..." : isOwn ? "Delete" : "Mod Delete"}
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
  const { user, profile, loading: authLoading } = useAuth();
  // Staff can mod-delete any comment (backed by 007's RLS policy +
  // the role re-check in the DELETE route — this flag is UI only).
  const isStaff = profile?.role === "owner" || profile?.role === "admin";
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  // Authors this viewer has blocked — their comments are hidden.
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const supabaseRef = useRef(createClient());

  // Load the viewer's block list once they're known. Failure is
  // harmless (nothing gets hidden) so errors are swallowed.
  useEffect(() => {
    if (!user) {
      setBlockedIds(new Set());
      return;
    }
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

  const fetchComments = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

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
    } else {
      setComments((data as unknown as CommentData[]) ?? []);
    }
    setLoading(false);
  }, [reviewId]);

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
    if (!res.ok) await throwServerError(res, "Couldn't post your comment.");
    await fetchComments();
  };

  const handleReply = async (parentId: string, content: string) => {
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, content, parentId }),
    });
    if (!res.ok) await throwServerError(res, "Couldn't post your reply.");
    setReplyingTo(null);
    await fetchComments();
  };

  const handleEdit = async (commentId: string, content: string) => {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) await throwServerError(res, "Couldn't save your edit.");
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
      if (!res.ok) await throwServerError(res, "Couldn't post your comment.");
      const created = (await res.json()) as CommentData;
      // created_at-ascending order means appending keeps the list
      // sorted; replies are re-grouped under their parent by the
      // threading pass below regardless of array position.
      setComments((prev) => [...prev, created]);
    },
    [reviewId]
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

  const visible = comments.filter((c) => !blockedIds.has(c.user_id));
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
            <span className="label-xbox">Comments</span>
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
          placeholder="Drop a comment..."
        />
      ) : (
        <div className="card-y2k p-4 text-center">
          <p className="text-sm text-text-muted">
            <Link
              href="/login"
              className="text-accent-primary hover:text-accent-glow transition-colors font-bold"
            >
              Sign in
            </Link>{" "}
            to comment
          </p>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="text-center py-8">
          <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
            Loading comments...
          </span>
        </div>
      ) : commentCount === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-text-muted">
            No comments yet. Be the first to share your thoughts.
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
                        "Unknown",
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
                    placeholder={`Reply to ${comment.profiles?.display_name || comment.profiles?.username || "user"}...`}
                    submitLabel="Reply"
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
