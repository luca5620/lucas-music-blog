import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
} from "@/lib/db/notifications";

/**
 * /api/notifications — the bell.
 *
 *   GET  → { notifications: NotificationRow[], unread: number }
 *   POST → mark everything read (called when the panel opens)
 *
 * Both scoped to the signed-in user by RLS; the ids in the rows are
 * the viewer's own notifications and nothing else can come back.
 */

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The bell polls — keep it generous but bounded.
  const limited = await rateLimit(`notifications:${user.id}`, 60, 60_000);
  if (limited) return limited;

  const [notifications, unread] = await Promise.all([
    getNotifications(user.id, 25),
    getUnreadCount(user.id),
  ]);
  return NextResponse.json({ notifications, unread });
}

export async function POST() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`notifications-read:${user.id}`, 30, 60_000);
  if (limited) return limited;

  await markAllRead(user.id);
  return NextResponse.json({ ok: true });
}
