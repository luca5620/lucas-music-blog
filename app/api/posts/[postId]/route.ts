import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPostById, deletePost, updatePost } from "@/lib/db/posts";
import { notifyFollowers } from "@/lib/db/notifications";
import { getReleaseById } from "@/lib/db/releases";
import {
  parseVideoUrl,
  isTikTokShortLink,
  type ParsedVideo,
} from "@/lib/video";
import { rateLimit } from "@/lib/rate-limit";
import { isText, isUuid } from "@/lib/validate";
import { checkContent } from "@/lib/content-filter";
import type { Profile } from "@/lib/types/database";

/**
 * PATCH /api/posts/[postId]
 *
 * Author-only edit. Same validation pipeline as creation: the client
 * sends { title, body, video_url?, release_id? } and the (kind, id)
 * pair is re-derived HERE — the raw pasted URL is never stored. The
 * slug never changes on edit, so existing links keep working.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Same budget as edits elsewhere — 10 per 5 minutes.
  const limited = await rateLimit(`posts-edit:${user.id}`, 10, 300_000);
  if (limited) return limited;

  const { postId } = await params;
  if (!isUuid(postId)) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const existing = await getPostById(postId);
  if (!existing) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const { title, body, video_url, release_id, is_published } = payload;

    if (is_published !== undefined && typeof is_published !== "boolean") {
      return NextResponse.json(
        { error: "Invalid draft flag." },
        { status: 400 }
      );
    }

    if (!isText(title, 120) || title.trim().length < 3) {
      return NextResponse.json(
        { error: "Title must be 3–120 characters." },
        { status: 400 }
      );
    }

    if (!isText(body, 10000)) {
      return NextResponse.json(
        { error: "Body must be 1–10,000 characters." },
        { status: 400 }
      );
    }

    // Zero-tolerance filter (App Store 1.2) — slurs never hit the DB.
    const dirty = checkContent(title, body);
    if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });

    let video: ParsedVideo | null = null;
    if (video_url != null && video_url !== "") {
      if (typeof video_url !== "string") {
        return NextResponse.json(
          { error: "Invalid video URL." },
          { status: 400 }
        );
      }
      if (isTikTokShortLink(video_url)) {
        return NextResponse.json(
          {
            error:
              "vm.tiktok.com share links can't be embedded — open the link and paste the full tiktok.com/@user/video/… URL.",
          },
          { status: 400 }
        );
      }
      video = parseVideoUrl(video_url);
      if (!video) {
        return NextResponse.json(
          {
            error:
              "That doesn't look like a YouTube or TikTok video link. Paste a youtube.com/watch, youtu.be, YouTube Shorts, or tiktok.com/@user/video URL.",
          },
          { status: 400 }
        );
      }
    }

    let releaseId: string | null = null;
    if (release_id != null && release_id !== "") {
      if (!isUuid(release_id)) {
        return NextResponse.json(
          { error: "Invalid release." },
          { status: 400 }
        );
      }
      const release = await getReleaseById(release_id);
      if (!release) {
        return NextResponse.json(
          { error: "Release not found." },
          { status: 400 }
        );
      }
      releaseId = release.id;
    }

    // Only forward the publish state when it would actually FLIP the
    // row. On a database that predates migration 024 the existing row
    // has no is_published at all (undefined), the check below never
    // fires, and the UPDATE never mentions the missing column — so
    // plain edits keep working before the migration runs.
    // (And when the client omits the flag entirely, leave the row's
    // publish state alone — an edit is not an implicit publish.)
    const wantsPublished = is_published as boolean | undefined;
    const flip =
      wantsPublished !== undefined &&
      typeof existing.is_published === "boolean" &&
      existing.is_published !== wantsPublished;

    const post = await updatePost(postId, {
      title: title.trim(),
      body,
      video,
      releaseId,
      ...(flip ? { isPublished: wantsPublished } : {}),
    });

    if (!post) {
      return NextResponse.json(
        { error: "Failed to update post." },
        { status: 500 }
      );
    }

    // Same as reviews: the publish is the announcement, not the save.
    if (flip && wantsPublished === true) {
      await notifyFollowers({
        actorId: user.id,
        type: "new_post",
        href: `/posts/${existing.slug}`,
        title: title.trim(),
      });
    }

    return NextResponse.json({ post });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}

/**
 * DELETE /api/posts/[postId]
 *
 * Author or staff. The role check here is the friendly layer — RLS is
 * what actually authorizes the delete (owners via the own-row policy,
 * staff via 013's "Admins can delete any post" policy, mirroring 007).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await params;
  if (!isUuid(postId)) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const existing = await getPostById(postId);
  if (!existing) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  // Author can always delete their own; otherwise only staff may.
  if (existing.user_id !== user.id) {
    const supabase = await createClient();
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profileData as Pick<Profile, "role"> | null)?.role;
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const success = await deletePost(postId);

  if (!success) {
    return NextResponse.json(
      { error: "Failed to delete post." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
