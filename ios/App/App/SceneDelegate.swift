import UIKit
import Capacitor

/// The scene delegate — REQUIRED from the iOS 27 SDK (2026-09-21).
///
/// Apple made the UIScene life cycle mandatory for any app built with
/// the SDK after iOS 26. Xcode 27 builds against the iOS 27 SDK, and
/// on an iOS 27 device or simulator UIKit refuses to launch an app
/// that still runs on the old AppDelegate-owns-the-window model: it
/// traps at launch with
///
///   "Application failed to launch: UIScene life cycle is required
///    for apps built with this SDK."
///
/// That trap (SIGTRAP, "launch failed" in the simulator log) is what
/// Luca hit running the shell from Xcode on the iPhone 17 / iOS 27
/// simulator. On iOS 26.5 the same binary launched fine, which is why
/// the splash hand-off verified earlier that day passed — the 26.5
/// runtime does not enforce the rule yet. Real phones on iOS 27 would
/// have hit exactly this on the TestFlight build.
///
/// The Capacitor 7 iOS template predates the rule and ships no scene
/// delegate, so the shell provides its own. Three parts, all here:
///
///  1. Info.plist gained UIApplicationSceneManifest, which points the
///     one window scene at this class and at Main.storyboard (the
///     UISceneStoryboardFile key replaces the old UIMainStoryboardFile).
///     UIKit therefore builds the window and installs the storyboard's
///     AppViewController in it before `scene(_:willConnectTo:)` runs;
///     nothing below creates a window by hand.
///  2. URL opens. Under scenes, UIKit no longer calls the AppDelegate's
///     `application(_:open:options:)` or `continue userActivity` — it
///     delivers them to the scene instead. Capacitor's App plugin
///     learns about them from ApplicationDelegateProxy (it posts the
///     NotificationCenter events the plugin listens for, and records
///     lastURL for getLaunchUrl()), so every scene-side entry point
///     below forwards to that same proxy. This is what keeps social
///     sign-in working: the OAuth code comes back from the system
///     browser as a com.peakmusicreviews.app:// deep link and the page
///     picks it up from the plugin's `appUrlOpen` event
///     (components/auth/OAuthButtons.tsx).
///  3. Cold launches FROM a link. The URL arrives in the connection
///     options before the storyboard's controller has loaded, i.e.
///     before the Capacitor bridge — and its App plugin — exist to
///     hear the notification. Forwarding is deferred one run-loop turn
///     so the bridge is up first; the plugin also retains the event
///     until the page registers a listener, so nothing is lost.
///
/// Everything that is NOT about the window or URLs stays in
/// AppDelegate.swift: the push-notification registration callbacks
/// are application-level in UIKit and still fire there.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    /// Set by UIKit from the storyboard named in Info.plist. The
    /// SplashScreen plugin reads `UIApplication.shared.delegate?.window`
    /// first and falls back to the connected scene's key window, so it
    /// finds this one; the StatusBar plugin goes through windowScene.
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard scene is UIWindowScene else { return }

        // A cold launch from a deep link or a Universal Link: the URL
        // rides in with the connection instead of arriving later. See
        // note 3 above for why this waits a turn before forwarding.
        let urlContexts = connectionOptions.urlContexts
        let activities = connectionOptions.userActivities
        if !urlContexts.isEmpty || !activities.isEmpty {
            DispatchQueue.main.async {
                self.forward(urlContexts)
                for activity in activities {
                    self.forward(activity)
                }
            }
        }
    }

    /// A deep link while the app is running (or suspended). This is
    /// the OAuth callback path.
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        forward(URLContexts)
    }

    /// A Universal Link (https://peakmusicreviews.com/… handed to the
    /// app by iOS) while the app is running.
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        forward(userActivity)
    }

    // MARK: - Forwarding to Capacitor

    private func forward(_ contexts: Set<UIOpenURLContext>) {
        for context in contexts {
            // Rebuild the options dictionary the old AppDelegate entry
            // point used to receive, so plugins see the same shape.
            var options: [UIApplication.OpenURLOptionsKey: Any] = [
                .openInPlace: context.options.openInPlace
            ]
            if let source = context.options.sourceApplication {
                options[.sourceApplication] = source
            }
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared, open: context.url, options: options
            )
        }
    }

    private func forward(_ activity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared, continue: activity, restorationHandler: { _ in }
        )
    }
}
