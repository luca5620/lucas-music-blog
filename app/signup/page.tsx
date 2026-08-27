"use client";

/**
 * /signup — create an account.
 *
 * The overhaul rules:
 * - usernames are 3-20 chars of letters/numbers/underscores, unique
 *   case-insensitively (DB enforces both; we validate live here so
 *   nobody finds out at submit time)
 * - email confirmation is REQUIRED: after signUp we show a CRT-style
 *   "CHECK YOUR INBOX" panel until they click the link. One account
 *   per real inbox — that's the anti-spam wall.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Matches the DB constraint from migration 006 exactly. We lowercase
// input as they type, so the effective alphabet is a-z 0-9 _.
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

// Names that would let someone impersonate the platform or its staff.
const RESERVED_USERNAMES = new Set([
  "admin", "peak", "mod", "moderator", "staff", "support",
  "api", "root", "system", "official", "help",
]);

/** Availability check result for the little status line. */
type Availability = "idle" | "checking" | "free" | "taken";

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  // Explicit EULA consent — App Store guideline 1.2 requires users
  // to actively AGREE to the terms before registering (a passive
  // "by signing up you agree" line got the app rejected).
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Tick the resend cooldown down once per second.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  /**
   * Validate format immediately, then (if it passes) ask the database
   * whether the name is taken — debounced so we don't query on every
   * keystroke. ilike gives us a case-insensitive match; underscores
   * are LIKE wildcards so we escape them to avoid false "taken"s.
   */
  const validateUsername = (value: string) => {
    const lower = value.toLowerCase();
    setUsername(lower);
    setAvailability("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (lower.length === 0) {
      setUsernameError(null);
      return;
    }
    if (lower.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return;
    }
    if (lower.length > 20) {
      setUsernameError("Username must be 20 characters or fewer");
      return;
    }
    if (!USERNAME_REGEX.test(lower)) {
      setUsernameError("Letters, numbers, and underscores only");
      return;
    }
    if (RESERVED_USERNAMES.has(lower)) {
      setUsernameError("That name is reserved");
      return;
    }
    setUsernameError(null);

    // Format is fine — now check availability after a quiet moment.
    setAvailability("checking");
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", lower.replace(/_/g, "\\_"))
        .maybeSingle();
      setAvailability(data ? "taken" : "free");
    }, 400);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (usernameError) return;
    if (!USERNAME_REGEX.test(username) || RESERVED_USERNAMES.has(username)) {
      setUsernameError("Please enter a valid username");
      return;
    }
    if (availability === "taken") {
      setUsernameError("That username is taken");
      return;
    }
    if (!agreedToTerms) {
      setError("You need to agree to the Terms of Use to create an account.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: username,
        },
        // After clicking the confirmation link, land back on the site
        // signed in (the browser client exchanges the code for us).
        emailRedirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });

    if (authError) {
      // Friendlier wording for the common case.
      setError(
        /already registered/i.test(authError.message)
          ? "That email already has an account — try signing in instead."
          : authError.message
      );
      setLoading(false);
      return;
    }

    // With confirmation ON, Supabase "succeeds" for an existing email
    // but returns a ghost user with no identities. Catch that so the
    // person isn't left staring at an inbox with nothing in it.
    if (data.user && data.user.identities?.length === 0) {
      setError("That email already has an account — try signing in instead.");
      setLoading(false);
      return;
    }

    if (data.session) {
      // Confirmation is disabled in the dashboard — we're signed in.
      router.push("/");
      router.refresh();
      return;
    }

    // Confirmation required (the normal path).
    setAwaitingConfirm(true);
    setResendCooldown(60);
    setLoading(false);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendNote(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResendNote(
      resendError
        ? "Couldn't resend — wait a minute and try again."
        : "Signal re-sent. Give it a minute (and check spam)."
    );
    setResendCooldown(60);
  };

  /* --- CHECK YOUR INBOX — post-signup holding screen --- */
  if (awaitingConfirm) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="panel-xbox-glow p-8 text-center space-y-5 relative overflow-hidden">
            <p className="osd-text text-sm">
              <span className="text-[#ff4455]">●</span> AWAITING SIGNAL
            </p>
            <h1 className="crt-title text-3xl">Check Your Inbox</h1>
            <p className="text-text-secondary text-sm leading-relaxed">
              Confirmation link sent to{" "}
              <span className="text-text-primary font-medium">{email}</span>.
              Click it to switch your account on — until then this channel
              stays static.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="btn-y2k btn-y2k-outline disabled:opacity-50"
              >
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend Link"}
              </button>
              <Link href="/login" className="btn-y2k btn-y2k-primary">
                Go to Sign In
              </Link>
            </div>
            {resendNote && (
              <p className="pixel-text text-sm text-accent-glow">{resendNote}</p>
            )}
            <div className="scan-bar" />
          </div>
        </div>
      </div>
    );
  }

  /* --- The signup form itself --- */
  const availabilityLine =
    availability === "checking" ? (
      <p className="mt-1.5 text-xs osd-text animate-pulse">CHECKING…</p>
    ) : availability === "free" && !usernameError && username ? (
      <p className="mt-1.5 text-xs text-accent-primary">✓ @{username} is free</p>
    ) : availability === "taken" ? (
      <p className="mt-1.5 text-xs text-accent-rose">@{username} is taken</p>
    ) : null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="panel-xbox-glow p-8 relative overflow-hidden">
          {/* Header */}
          <div className="text-center mb-8 space-y-2">
            <h1 className="crt-title text-3xl">CREATE ACCOUNT</h1>
            <p className="text-text-secondary text-sm">
              claim your handle on Peak Music Reviews
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignUp} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => validateUsername(e.target.value)}
                required
                className="form-input"
                placeholder="your_username"
                autoComplete="username"
              />
              {usernameError ? (
                <p className="mt-1.5 text-xs text-red-400">{usernameError}</p>
              ) : (
                availabilityLine
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
                placeholder="you@example.com"
                autoComplete="email"
              />
              <p className="mt-1.5 text-xs text-text-muted">
                You&apos;ll confirm this — one account per inbox.
              </p>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="form-input"
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>

            {/* EULA consent — an ACTIVE checkbox, not implied consent.
                App Store 1.2: users must agree to terms that make the
                zero-tolerance policy explicit before registering. */}
            <label className="flex items-start gap-3 p-3 rounded border border-border-medium bg-bg-elevated/40 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--accent-primary,#1e90ff)]"
              />
              <span className="text-xs text-text-secondary leading-relaxed">
                I agree to the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-accent-primary hover:underline"
                >
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-accent-primary hover:underline"
                >
                  Privacy Policy
                </Link>
                , including the{" "}
                <span className="text-text-primary font-medium">
                  zero-tolerance policy
                </span>{" "}
                for objectionable content and abusive users.
              </span>
            </label>

            <button
              type="submit"
              disabled={
                loading ||
                !!usernameError ||
                availability === "taken" ||
                !agreedToTerms
              }
              className="btn-y2k btn-y2k-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Tuning in…" : "Create Account"}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-accent-primary hover:text-accent-glow hover:underline"
            >
              Sign in
            </Link>
          </p>

          <div className="scan-bar" />
        </div>
      </div>
    </div>
  );
}
