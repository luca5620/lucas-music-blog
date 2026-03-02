"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navigation — Inside the CRT frame.
 * Xbox 360 blue as the primary accent color.
 */

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/reviews", label: "Reviews" },
  { href: "/analytics", label: "Analytics" },
  { href: "/about", label: "About" },
];

export default function Navigation() {
  const pathname = usePathname();

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
      </div>
    </nav>
  );
}
