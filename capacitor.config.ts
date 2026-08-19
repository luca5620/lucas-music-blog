import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config — the native iOS/Android shell.
 *
 * Strategy: the app is a native WebView that loads the LIVE site
 * (server.url). That means every deploy to Vercel updates the app
 * instantly with no App Store re-review, and there's one codebase.
 * The local `mobile/www` folder only holds the offline fallback
 * page shown when the phone has no connection.
 *
 * Native seasoning (haptics, share sheet, status bar) comes from the
 * injected Capacitor bridge — see lib/native.ts.
 */
const config: CapacitorConfig = {
  appId: "com.peakmusicreviews.app",
  appName: "PEAK",
  webDir: "mobile/www",
  backgroundColor: "#060607",
  server: {
    url: "https://peakmusicreviews.com",
    // Domains the WebView may navigate to without bouncing to Safari.
    allowNavigation: ["peakmusicreviews.com", "*.supabase.co"],
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#060607",
  },
  android: {
    backgroundColor: "#060607",
  },
};

export default config;
