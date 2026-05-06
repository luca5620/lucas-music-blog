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

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/reviews", label: "Reviews" },
  { href: "/friends", label: "Friends" },
  { href: "/for-you", label: "For You" },
];

export default function Navigation() {
  const pathname = usePathname();
  const { user, profile, loading, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
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
    <nav className="border-b border-border-subtle pb-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Logo / Site Title */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
          <img src="/penguin-logo.png" alt="Peak Music Reviews" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover" />
          <span className="pixel-text text-base sm:text-xl text-accent-primary group-hover:text-accent-glow transition-colors glitch-hover">
            Peak Music Reviews
          </span>
        </Link>

        {/* Nav Links + Auth */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Nav Links — horizontally scrollable on mobile */}
          <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
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

          {/* Write Review — only when logged in */}
          {!loading && user && (
            <Link
              href="/reviews/new"
              className="inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold tracking-wide uppercase transition-all duration-200 whitespace-nowrap shrink-0 text-accent-primary hover:bg-accent-primary/10 border border-accent-primary/30 hover:border-accent-primary/50 font-[family-name:var(--font-heading)]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Review</span>
            </Link>
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
                    <span className="hidden sm:inline text-sm text-text-secondary font-[family-name:var(--font-heading)]">
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
                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#1e1e22] border border-white/10 rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden z-50">
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
