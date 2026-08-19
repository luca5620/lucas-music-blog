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
 * Tabs are Luca's spec: Home / Releases / Reviews / Debates / Profile.
 * Lists, Friends and Your Taste stay reachable in-app via the avatar
 * dropdown (app-only links) and the homepage.
 */

type Tab = {
  href: string;
  label: string;
  /** Marks the tab active when the path starts with this (default: href). */
  match?: string;
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
  releases: (
    // A record — fits "Releases" better than any generic icon
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  ),
  reviews: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 2.7 5.6 6.3.9-4.5 4.4 1 6.1L12 17.2 6.5 20l1-6.1L3 9.5l6.3-.9L12 3z" />
    </svg>
  ),
  debates: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 12h.01M12 12h.01M16 12h.01" />
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
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

  // Bridge check must wait for mount — SSR can't know it's the app.
  useEffect(() => {
    setNative(isNativeApp());
  }, []);

  if (!native) return null;

  // Profile tab: your own profile when signed in, sign-in otherwise.
  const profileHref =
    user && profile?.username ? `/profile/${profile.username}` : "/login";

  const tabs: Tab[] = [
    { href: "/", label: "Home", icon: icons.home },
    { href: "/releases", label: "Releases", icon: icons.releases },
    { href: "/reviews", label: "Reviews", icon: icons.reviews },
    { href: "/debates", label: "Debates", icon: icons.debates },
    { href: profileHref, label: "Profile", icon: icons.profile },
  ];

  return (
    <nav className="tab-bar" aria-label="App navigation">
      {tabs.map((tab) => {
        const match = tab.match ?? tab.href;
        const isActive =
          match === "/" ? pathname === "/" : pathname.startsWith(match);
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
