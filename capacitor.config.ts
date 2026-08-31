import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config - the native iOS/Android shell.
 *
 * Strategy: the app is a native WebView that loads the LIVE site
 * (server.url). That means every deploy to Vercel updates the app
 * instantly with no App Store re-review, and there's one codebase.
 * The local `mobile/www` folder only holds the offline fallback
 * page shown when the phone has no connection.
 *
 * Native seasoning (haptics, share sheet, status bar) comes from the
 * injected Capacitor bridge - see lib/native.ts.
 */
const config: CapacitorConfig = {
  appId: "com.peakmusicreviews.app",
  // Home-screen label. "Peak Music" (Luca 2026-08-31): the full name
  // truncated on the iPhone home screen, and the short form is also
  // the parked-rebrand's approved under-icon name. Changed in all
  // three places — here, ios/App/App/Info.plist (CFBundleDisplayName),
  // android strings.xml — plus the PWA manifest's short_name. The App
  // Store LISTING name is set in App Store Connect and keeps the full
  // "Peak Music Reviews" for search. Takes effect on the next build
  // submitted, not via a web deploy.
  appName: "Peak Music",
  webDir: "mobile/www",
  backgroundColor: "#000000",
  server: {
    url: "https://peakmusicreviews.com",
    // Domains the WebView may navigate to without bouncing to Safari.
    allowNavigation: ["peakmusicreviews.com", "*.supabase.co"],
    // No connection (or the site unreachable) → show the local
    // NO SIGNAL page from mobile/www instead of a black screen.
    // Without this the WebView just failed silently to black.
    errorPath: "index.html",
  },
  ios: {
    // "never", NOT "automatic": automatic made UIScrollView add
    // safe-area insets at BOTH scroll ends — the black bars above/
    // below every scrollable page (Luca 2026-08-19). The page handles
    // its own safe areas via env() padding (globals.css native-app
    // section), so the WebView must go true edge-to-edge.
    contentInset: "never",
    backgroundColor: "#000000",
    // No long-press link previews — the app should feel like an app,
    // not a webpage in a frame. (Luca's request, 2026-08-19.)
    allowsLinkPreview: false,
  },
  android: {
    backgroundColor: "#000000",
  },
  plugins: {
    // Branded splash: the black penguin image in Splash.imageset.
    // Short + no spinner — it's a curtain, not a loading screen.
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#000000",
      showSpinner: false,
    },
    // Light clock/battery text on the true-black app ("DARK" = dark
    // background style). backgroundColor/overlays are Android-only.
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
      overlaysWebView: true,
    },
  },
};

export default config;
