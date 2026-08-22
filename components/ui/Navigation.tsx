"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { VerifiedBadge } from "@/components/ui/RoleBadge";

/**
 * Navigation — Inside the CRT frame.
 * Xbox 360 blue as the primary accent color.
 */

// Home lives on the penguin logo (no Home tab needed).
// Posts deliberately have no tab (Luca: no new module) — creating one
// lives in the CREATE menu, browsing surfaces through feeds + /posts.
const navLinks = [
  { href: "/releases", label: "Releases" },
  { href: "/reviews", label: "Reviews" },
  { href: "/lists", label: "Lists" },
  { href: "/debates", label: "Debates" },
  { href: "/friends", label: "Friends" },
  { href: "/your-taste", label: "Your Taste" },
];

export default function Navigation() {
  const pathname = usePathname();
  const { user, profile, loading, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);

  // Close either dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
      if (
        createRef.current &&
        !createRef.current.contains(event.target as Node)
      ) {
        setCreateOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut();
  };

  return (
    // relative z-40 lifts the whole nav above later page sections —
    // .crt-screen gives every direct child z-index:1, so without this
    // the avatar dropdown painted UNDER content further down the DOM.
    <nav className="border-b border-border-subtle pb-4 mb-6 relative z-40">
      {/* Two rows below lg: with 7 nav links plus the spine eating
          width, a single row crushed the account button. On lg+ it's
          the classic one-line bar again. */}
      {/* Tabs are LEFT-justified: they sit right after the logo, and
          the flex-1 links strip pushes Review + account to the far
          right edge instead of dragging the tabs along with them. */}
      {/* app-nav-row: in the native shell the link strip is hidden, so
          this collapses to ONE row — logo left, CREATE + avatar right
          (globals.css forces flex-row + justify-between there). */}
      <div className="app-nav-row flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Logo / Site Title */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
          <img src="/penguin-logo.png" alt="Peak Music Reviews" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover" />
          {/* Full name at every size — Luca's preference over "PMR" */}
          <span className="pixel-text text-base sm:text-xl text-accent-primary group-hover:text-accent-glow transition-colors glitch-hover whitespace-nowrap">
            Peak Music Reviews
          </span>
        </Link>

        {/* Nav Links + Auth.
            min-w-0 + flex-1 on the links strip makes IT the only thing
            that gives way when space runs out (it scrolls sideways) —
            the Review button and account button can never be pushed
            past the screen edge and clipped again. */}
        {/* justify-end is a no-op on web (the flex-1 strip eats all free
            space) but right-aligns CREATE + avatar in the app, where the
            strip is hidden. */}
        <div className="flex items-center justify-end gap-1 sm:gap-2 min-w-0 w-full lg:flex-1">
          {/* Nav Links — can still scroll sideways on tiny screens,
              but the scrollbar itself is hidden (no-scrollbar).
              justify-evenly: the tabs spread UNIFORMLY across the gap
              between the site title and the CREATE button instead of
              packing left (Luca 2026-08-22). Once space runs out the
              strip overflows and evenly-ness naturally gives way to
              scrolling. app-hide: in the native shell the bottom
              TabBar is the primary nav, so this strip disappears. */}
          <div className="app-hide flex flex-1 min-w-0 items-center justify-evenly gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold tracking-wide uppercase transition-all duration-200 whitespace-nowrap shrink-0
                    font-[family-name:var(--font-heading)]
                    ${
                      isActive
                        ? "bg-accent-primary/15 text-accent-primary border border-accent-primary/30"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated border border-transparent"
                    }
                  `}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* CREATE — one button for both content types (Luca 2026-08-19:
              fold posts into the review button, pick a name that fits
              both). Click → choose Review or Post. */}
          {!loading && user && (
            <div className="relative shrink-0" ref={createRef}>
              <button
                onClick={() => setCreateOpen(!createOpen)}
                aria-expanded={createOpen}
                aria-haspopup="menu"
                className="inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold tracking-wide uppercase transition-all duration-200 whitespace-nowrap text-accent-primary hover:bg-accent-primary/10 border border-accent-primary/30 hover:border-accent-primary/50 font-[family-name:var(--font-heading)]"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Create</span>
              </button>

              {createOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#141418] border border-white/10 rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.7)] z-50 p-2 space-y-1.5">
                  {/* Real button treatment — bordered cards that light up
                      on hover/focus so it's obvious which one you're on. */}
                  <Link
                    href="/reviews/new"
                    onClick={() => setCreateOpen(false)}
                    className="group flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 transition-all hover:border-accent-primary/60 hover:bg-accent-primary/10 focus-visible:border-accent-primary/60 focus-visible:bg-accent-primary/10 focus:outline-none"
                  >
                    <span className="w-8 h-8 shrink-0 rounded-full border border-accent-primary/30 bg-accent-primary/10 flex items-center justify-center text-base group-hover:border-accent-primary/60 transition-colors">
                      ★
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors font-[family-name:var(--font-heading)] uppercase tracking-wide">
                        Review
                      </span>
                      <span className="block text-xs text-text-muted">
                        rate a release
                      </span>
                    </span>
                  </Link>
                  <Link
                    href="/posts/new"
                    onClick={() => setCreateOpen(false)}
                    className="group flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 transition-all hover:border-accent-primary/60 hover:bg-accent-primary/10 focus-visible:border-accent-primary/60 focus-visible:bg-accent-primary/10 focus:outline-none"
                  >
                    <span className="w-8 h-8 shrink-0 rounded-full border border-accent-primary/30 bg-accent-primary/10 flex items-center justify-center text-base group-hover:border-accent-primary/60 transition-colors">
                      ▶
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors font-[family-name:var(--font-heading)] uppercase tracking-wide">
                        Post
                      </span>
                      <span className="block text-xs text-text-muted">
                        write it up — embed YouTube / TikTok
                      </span>
                    </span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Auth Section */}
          {!loading && (
            <div className="ml-2 shrink-0">
              {user ? (
                /* Logged in — avatar + dropdown */
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-bg-elevated transition-colors border border-transparent hover:border-white/10"
                  >
                    {/* Avatar */}
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.display_name || profile.username}
                        className="w-7 h-7 rounded-full object-cover border border-white/10"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-accent-primary uppercase">
                          {(profile?.username || user.email || "U").charAt(0)}
                        </span>
                      </div>
                    )}
                    {/* inline-block, not inline — truncate/max-width are
                        ignored on plain inline elements, which is why the
                        earlier attempt didn't ellipsize. Dropdown shows
                        the full name regardless. */}
                    <span className="hidden sm:inline-block align-middle text-sm text-text-secondary font-[family-name:var(--font-heading)] max-w-[9rem] truncate">
                      {profile?.display_name || profile?.username || "User"}
                    </span>
                    {profile?.role && profile.role !== "user" && (
                      <VerifiedBadge role={profile.role} />
                    )}
                    {/* Chevron */}
                    <svg
                      className={`w-3.5 h-3.5 text-text-muted transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-60 bg-[#141418] border border-white/10 rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.7)] overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-white/5">
                        <p className="text-sm font-medium text-text-primary truncate flex items-center gap-1.5">
                          <span>{profile?.display_name || profile?.username}</span>
                          {profile?.role && profile.role !== "user" && (
                            <VerifiedBadge role={profile.role} />
                          )}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                          {user.email}
                        </p>
                      </div>
                      <div className="py-1">
                        <Link
                          href={`/profile/${profile?.username || ""}`}
                          onClick={() => setDropdownOpen(false)}
                          className="block px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                        >
                          Profile
                        </Link>
                        <Link
                          href="/reviews/mine"
                          onClick={() => setDropdownOpen(false)}
                          className="block px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                        >
                          My Reviews
                        </Link>
                        <Link
                          href="/settings/profile"
                          onClick={() => setDropdownOpen(false)}
                          className="block px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                        >
                          Settings
                        </Link>
                        {/* App-only (display:none on web): these pages
                            have no bottom tab, so the dropdown is how
                            the app reaches them. */}
                        <div className="app-only">
                          <div className="my-1 border-t border-white/5" />
                          <Link
                            href="/your-taste"
                            onClick={() => setDropdownOpen(false)}
                            className="block px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                          >
                            Your Taste
                          </Link>
                          <Link
                            href="/lists"
                            onClick={() => setDropdownOpen(false)}
                            className="block px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                          >
                            Lists
                          </Link>
                          <Link
                            href="/friends"
                            onClick={() => setDropdownOpen(false)}
                            className="block px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                          >
                            Friends
                          </Link>
                        </div>
                        {(profile?.role === "owner" || profile?.role === "admin") && (
                          <>
                            <div className="my-1 border-t border-white/5" />
                            <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-widest text-text-muted font-[family-name:var(--font-vt323)]">
                              Admin
                            </p>
                            <Link
                              href="/admin/import"
                              onClick={() => setDropdownOpen(false)}
                              className="block px-4 py-2 text-sm text-accent-primary hover:text-accent-glow hover:bg-bg-elevated transition-colors"
                            >
                              Import Release
                            </Link>
                            <Link
                              href="/admin/reports"
                              onClick={() => setDropdownOpen(false)}
                              className="block px-4 py-2 text-sm text-accent-primary hover:text-accent-glow hover:bg-bg-elevated transition-colors"
                            >
                              Reports
                            </Link>
                            <div className="my-1 border-t border-white/5" />
                          </>
                        )}
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2 text-sm text-accent-rose hover:bg-bg-elevated transition-colors"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Not logged in — Sign In button */
                <Link
                  href="/login"
                  className="px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold tracking-wide uppercase transition-all duration-200 whitespace-nowrap bg-accent-primary/15 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/25 font-[family-name:var(--font-heading)]"
                >
                  Sign In
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
