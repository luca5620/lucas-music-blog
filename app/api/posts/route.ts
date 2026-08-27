import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createPost } from "@/lib/db/posts";
import { getReleaseById } from "@/lib/db/releases";
import { parseVideoUrl, isTikTokShortLink, type ParsedVideo } from "@/lib/video";
import { rateLimit } from "@/lib/rate-limit";
import { isText, isUuid } from "@/lib/validate";
import { checkContent } from "@/lib/content-filter";

/**
 * POST /api/posts
 *
 * Creates a post. The client sends
 *   { title, body, video_url?, release_id? }
 * and everything derived — the slug, the (kind, id) pair extracted from
 * video_url — is computed HERE. We never store the raw pasted URL: the
 * embed iframe src is rebuilt from an allowlisted template + the
 * extracted id, so nothing the client typed reaches an href (XSS defense).
 */
export async function POST(request: Request) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Max 5 new posts per user per 5 minutes — same budget as reviews.
  const limited = await rateLimit(`posts:${user.id}`, 5, 300_000);
  if (limited) return limited;

  try {
    const payload = await request.json();
    const { title, body, video_url, release_id, is_published } = payload;

    // --- Validate. Nothing in the body is trusted. ---
    // Draft flag: anything other than an explicit false means publish.
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

    // The optional video: parse or reject, never pass through.
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

    // The optional tied release must be a real catalog row.
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

    // Username for the slug.
    const supabase = await createClient();
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    const username = (profileRow as { username: string } | null)?.username;
    if (!username) {
      return NextResponse.json({ error: "Profile not found." }, { status: 400 });
    }

    const post = await createPost({
      userId: user.id,
      username,
      title: title.trim(),
      body,
      video,
      releaseId,
      isPublished: is_published !== false,
    });

    if (!post) {
      return NextResponse.json(
        { error: "Failed to create post." },
        { status: 500 }
      );
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
