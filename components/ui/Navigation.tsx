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
      <div className="flex items-center justify-between">
        {/* Logo / Site Title */}
        <Link href="/" className="flex items-center gap-3 group">
          <img src="/penguin-logo.png" alt="Peak Music Reviews" className="w-8 h-8 rounded-full object-cover" />
          <span className="pixel-text text-xl text-accent-primary group-hover:text-accent-glow transition-colors glitch-hover">
            Peak Music Reviews
          </span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  px-4 py-2 rounded-full text-sm font-bold tracking-wide uppercase transition-all duration-200
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
