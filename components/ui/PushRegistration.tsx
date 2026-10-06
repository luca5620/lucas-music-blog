"use client";

/**
 * PushRegistration — app-only, renders nothing (2026-08-31).
 *
 * The client half of push notifications. When a signed-in user runs
 * the iOS shell (Android is gated off until FCM exists — see the
 * comment at the platform check below):
 *  1. ask iOS for notification permission (first run only —
 *     after that checkPermissions answers without a prompt),
 *  2. register with APNs,
 *  3. POST the device token to /api/push/register, which upserts it
 *     into push_tokens (migration 029) under the caller's session,
 *     along with the language the app is showing (052) so pushes
 *     arrive in that language.
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

    // iOS ONLY, for now. On Android, @capacitor/push-notifications
    // talks to Firebase Cloud Messaging, and calling register() without
    // a Firebase config (android/app/google-services.json — not in the
    // repo, because there's no Firebase project yet) CRASHES THE APP
    // natively: FirebaseApp isn't initialized, the plugin throws on the
    // Java side, and no JS try/catch can stop it. So Android never asks.
    //
    // To turn Android push on later (the Play launch):
    //   1. create a Firebase project, add the Android app
    //      (com.peakmusicreviews.app), download google-services.json
    //      into android/app/ and apply the google-services Gradle
    //      plugin (Capacitor's template has the lines, commented);
    //   2. teach push-fanout + push-recap to send FCM HTTP v1 (they
    //      skip platform = 'android' tokens today);
    //   3. widen this check to Android — but ONLY for binaries that
    //      carry the config. This gate lives on the LIVE site, so it
    //      reaches every installed Android build at once, and an older
    //      build without google-services.json would crash exactly like
    //      today. Gate on a build number (the way SplashCurtain uses
    //      appBuildNumber() — the Android shell would need to append
    //      the same PMRBuild/<n> user-agent token iOS does).
    if (nativePlatform() !== "ios") return;
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
