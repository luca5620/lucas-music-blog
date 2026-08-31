"use client";

/**
 * PushRegistration — app-only, renders nothing (2026-08-31).
 *
 * The client half of push notifications. When a signed-in user runs
 * the native shell:
 *  1. ask iOS/Android for notification permission (first run only —
 *     after that checkPermissions answers without a prompt),
 *  2. register with APNs/FCM,
 *  3. POST the device token to /api/push/register, which upserts it
 *     into push_tokens (migration 029) under the caller's session.
 *
 * Delivery is the other half: a Database Webhook on notifications
 * INSERT calls the `push-fanout` edge function, which looks up the
 * recipient's tokens and talks to APNs — see docs/PUSH-NOTIFICATIONS.md.
 *
 * Tapping a delivered push deep-links: the payload carries the same
 * `href` the in-app bell uses, and the tap listener navigates there.
 *
 * On the plain web (no bridge) and on signed-out sessions this
 * mounts, does nothing, and unmounts clean — the TabBar pattern.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { isNativeApp, nativePlatform, pushPlugin } from "@/lib/native";

export default function PushRegistration() {
  const { user } = useAuth();
  const router = useRouter();
  // One registration per (mounted app, user) — HMR/StrictMode double
  // effects and auth refreshes must not stack duplicate listeners.
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    const push = pushPlugin();
    if (!user || !push || !isNativeApp()) return;
    if (registeredFor.current === user.id) return;
    registeredFor.current = user.id;

    let cancelled = false;

    async function setUp() {
      if (!push) return;
      try {
        // Listeners FIRST — register() can fire 'registration'
        // synchronously when the OS has a cached token.
        await push.addListener(
          "registration",
          (token: { value: string }) => {
            if (cancelled || !token?.value) return;
            void fetch("/api/push/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: token.value,
                platform: nativePlatform(),
              }),
            }).catch(() => {
              /* best-effort — next launch retries */
            });
          }
        );

        // A tapped push opens the app at the thing that happened —
        // same href the bell rows link to.
        await push.addListener(
          "pushNotificationActionPerformed",
          (action: { notification?: { data?: { href?: string } } }) => {
            const href = action?.notification?.data?.href;
            if (typeof href === "string" && href.startsWith("/")) {
              router.push(href);
            }
          }
        );

        let status = await push.checkPermissions();
        if (status.receive === "prompt") {
          status = await push.requestPermissions();
        }
        if (status.receive === "granted") {
          await push.register();
        }
        // "denied": respect it — iOS won't re-prompt anyway; the user
        // can flip it in Settings and the next launch registers.
      } catch {
        /* push is garnish on top of the in-app bell — never break
           the app over it */
      }
    }

    void setUp();

    return () => {
      cancelled = true;
    };
  }, [user, router]);

  return null;
}
