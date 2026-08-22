"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isNativeApp, hapticTap } from "@/lib/native";

/**
 * TabBar — app-only bottom navigation (iOS/Android shell).
 *
 * The single biggest "this is an app, not Safari" signal: a fixed
 * bottom tab bar like every native iOS app. Renders NOTHING on the
 * web — it mounts, asks the Capacitor bridge if we're in the shell,
 * and only then appears. Web visitors keep the top nav untouched;
 * in the app the top link strip hides (.app-hide in globals.css)
 * and this takes over as primary navigation.
 *
 * Tabs: Home / Taste / Search (middle) / Friends / Profile — Luca's
 * exact lineup, 2026-08-22. Reviews, Releases, Debates, Lists,
 * Artists, and Posts all moved to the quick-access strip at the top
 * of the home page (app-only chips); /search is the universal
 * everything-search. The strip + search REPLACE browse tabs — don't
 * re-add one without asking him.
 */

type Tab = {
  href: string;
  label: string;
  /** Marks the tab active when the path starts with any of these (default: [href]). */
  match?: string[];
  icon: React.ReactNode;
};

// 22px line icons, stroke = currentColor so the active tint applies.
const icons = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </svg>
  ),
  taste: (
    // Sparkles — the personalized feed
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4 13.9 9.1 19 11l-5.1 1.9L12 18l-1.9-5.1L5 11l5.1-1.9L12 4z" />
      <path d="M19 3v3M17.5 4.5h3" />
      <path d="M5 17v3M3.5 18.5h3" />
    </svg>
  ),
  friends: (
    // Two people — the friends activity feed
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c1.2-3.1 3.6-4.7 6.5-4.7s5.3 1.6 6.5 4.7" />
      <path d="M16 5a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18.5 15.6c1.6.8 2.6 2.3 3 4.4" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.2-4.2" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.4-3.6 4.4-5.5 8-5.5s6.6 1.9 8 5.5" />
    </svg>
  ),
};

export default function TabBar() {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const [native, setNative] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Bridge check must wait for mount — SSR can't know it's the app.
  useEffect(() => {
    setNative(isNativeApp());
  }, []);

  // When the on-screen keyboard is up, position:fixed pins to the
  // LAYOUT viewport (which the keyboard doesn't shrink on iOS) — the
  // bar detached and floated over mid-screen content while typing +
  // scrolling. Watch the VISUAL viewport instead: a big height drop
  // means keyboard, and native apps hide tab bars under keyboards.
  useEffect(() => {
    if (!native) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [native]);

  if (!native) return null;

  // Profile tab: your own profile when signed in, sign-in otherwise.
  const profileHref =
    user && profile?.username ? `/profile/${profile.username}` : "/login";

  const tabs: Tab[] = [
    { href: "/", label: "Home", icon: icons.home },
    // "Taste", not "For You" — Luca 2026-08-22: don't copy TikTok's
    // label, and the short form fits the narrow tab cell.
    { href: "/your-taste", label: "Taste", icon: icons.taste },
    { href: "/search", label: "Search", icon: icons.search },
    {
      href: "/friends",
      label: "Friends",
      // /connections is reached from the friends/profile flow — keep
      // the tab lit there too.
      match: ["/friends", "/connections"],
      icon: icons.friends,
    },
    { href: profileHref, label: "Profile", icon: icons.profile },
  ];

  return (
    <nav
      className={`tab-bar${keyboardOpen ? " keyboard-open" : ""}`}
      aria-label="App navigation"
    >
      {tabs.map((tab) => {
        const matches = tab.match ?? [tab.href];
        const isActive = matches.some((m) =>
          m === "/" ? pathname === "/" : pathname.startsWith(m),
        );
        return (
          <Link
            key={tab.label}
            href={tab.href}
            onClick={() => hapticTap()}
            aria-current={isActive ? "page" : undefined}
            className={`tab-bar-item${isActive ? " active" : ""}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
