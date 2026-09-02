"use client";

/**
 * /signup — create an account, one question per screen.
 *
 * Luca 2026-09-02: the old page was a five-field form in a box. Now
 * it walks: the door (Google / Apple / email) → email → username →
 * password → the rules → "check your inbox". Same rules as before:
 * - usernames are 3-20 chars of letters/numbers/underscores, unique
 *   case-insensitively (DB enforces both; we validate live so nobody
 *   finds out at submit time)
 * - email confirmation is REQUIRED: after signUp we hold on a
 *   "check your inbox" screen until they click the link. One account
 *   per real inbox — that's the anti-spam wall.
 * - the EULA is an ACTIVE checkbox (App Store 1.2) — it gets its own
 *   screen so it can't be skimmed past.
 *
 * Every step is a <form>, so Enter advances and the phone keyboard's
 * "go" works. Nothing is sent to Supabase until the final step.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import OAuthButtons from "@/components/auth/OAuthButtons";
import AuthShell, { ContinueButton } from "@/components/auth/AuthShell";
// The handle rules (charset from migration 006, the reserved list
// from 028's trigger) live in lib/username — /welcome asks the same
// question after a Google/Apple sign-in and the two must not drift.
import { USERNAME_REGEX, RESERVED_USERNAMES } from "@/lib/username";

/** Availability check result for the little status line. */
type Availability = "idle" | "checking" | "free" | "taken";

/** The screens, in order. Every one gets a progress dot — the door
    included — so the tracker is on screen from the first tap (Luca
    2026-09-02). */
type Step = "door" | "email" | "username" | "password" | "terms";
const QUESTION_STEPS: Step[] = ["door", "email", "username", "password", "terms"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpPage() {
  const [step, setStep] = useState<Step>("door");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  /** Move between screens; errors are per-screen so they clear. */
  function go(next: Step) {
    setError(null);
    setStep(next);
  }

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
      setUsernameError("At least 3 characters");
      return;
    }
    if (lower.length > 20) {
      setUsernameError("20 characters or fewer");
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

  /* --- Per-step "can I continue?" --- */
  const emailOk = EMAIL_RE.test(email.trim());
  const usernameOk =
    username.length > 0 && !usernameError && availability === "free";
  const passwordOk = password.length >= 6;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!USERNAME_REGEX.test(username) || RESERVED_USERNAMES.has(username)) {
      go("username");
      setUsernameError("Please enter a valid username");
      return;
    }
    if (availability === "taken") {
      go("username");
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
      email: email.trim(),
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
      email: email.trim(),
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
      <AuthShell
        title="Check your inbox"
        helper={
          <>
            We sent a confirmation link to{" "}
            <span className="text-text-primary font-medium">{email.trim()}</span>.
            Click it to switch your account on — until then this channel
            stays static.
          </>
        }
        steps={QUESTION_STEPS.length}
        step={QUESTION_STEPS.length - 1}
        footer={
          <>
            Wrong address?{" "}
            <button
              type="button"
              onClick={() => {
                setAwaitingConfirm(false);
                go("email");
              }}
              className="text-accent-primary hover:text-accent-glow hover:underline"
            >
              Start over
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="osd-text text-sm text-center">
            <span className="text-[#ff4455]">●</span> AWAITING SIGNAL
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="btn-y2k btn-y2k-outline w-full justify-center disabled:opacity-50"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend link"}
          </button>
          <Link href="/login" className="btn-y2k btn-y2k-primary w-full justify-center">
            Go to sign in
          </Link>
          {resendNote && (
            <p className="pixel-text text-sm text-accent-glow text-center">{resendNote}</p>
          )}
        </div>
      </AuthShell>
    );
  }

  const footer = (
    <>
      Already have an account?{" "}
      <Link href="/login" className="text-accent-primary hover:text-accent-glow hover:underline">
        Sign in
      </Link>
    </>
  );

  /* ---------------- THE DOOR ---------------- */
  if (step === "door") {
    return (
      <AuthShell
        title="Create your account"
        helper="every album. every leak. every argument."
        steps={QUESTION_STEPS.length}
        step={0}
        error={error}
        footer={footer}
      >
        {/* One-tap doors — no inbox confirmation, no password, and
            the handle gets picked on /welcome straight after.
            Renders nothing inside a 1.0 app shell. */}
        <OAuthButtons />
        {/* OAuthButtons draws its own OR rule under the doors. */}
        <div className="h-4" />
        <button
          type="button"
          onClick={() => go("email")}
          className="btn-y2k btn-y2k-primary w-full justify-center"
        >
          Continue with email
        </button>
      </AuthShell>
    );
  }

  /* ---------------- EMAIL ---------------- */
  if (step === "email") {
    return (
      <AuthShell
        title="Enter your email"
        helper="For sign-in and account recovery — you'll confirm it, one account per inbox."
        steps={QUESTION_STEPS.length}
        step={1}
        onBack={() => go("door")}
        error={error}
        footer={footer}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (emailOk) go("username");
          }}
        >
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="form-input text-center text-base"
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
          />
          <ContinueButton disabled={!emailOk} />
        </form>
      </AuthShell>
    );
  }

  /* ---------------- USERNAME ---------------- */
  if (step === "username") {
    const availabilityLine =
      usernameError ? (
        <p className="mt-2 text-xs text-red-400 text-center">{usernameError}</p>
      ) : availability === "checking" ? (
        <p className="mt-2 text-xs osd-text animate-pulse text-center">CHECKING…</p>
      ) : availability === "free" && username ? (
        <p className="mt-2 text-xs text-accent-primary text-center">✓ @{username} is free</p>
      ) : availability === "taken" ? (
        <p className="mt-2 text-xs text-accent-rose text-center">@{username} is taken</p>
      ) : null;

    return (
      <AuthShell
        title="Choose a username"
        helper="3–20 characters: letters, numbers, underscores. It's in every review URL you write."
        steps={QUESTION_STEPS.length}
        step={2}
        onBack={() => go("email")}
        error={error}
        footer={footer}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (usernameOk) go("password");
          }}
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-base pointer-events-none">
              @
            </span>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => validateUsername(e.target.value)}
              required
              className="form-input text-center text-base pl-8"
              placeholder="your_username"
              autoComplete="username"
              autoFocus
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
            />
          </div>
          {availabilityLine}
          <ContinueButton disabled={!usernameOk} />
        </form>
      </AuthShell>
    );
  }

  /* ---------------- PASSWORD ---------------- */
  if (step === "password") {
    return (
      <AuthShell
        title="Create a password"
        helper="At least 6 characters. Make it one you don't use anywhere else."
        steps={QUESTION_STEPS.length}
        step={3}
        onBack={() => go("username")}
        error={error}
        footer={footer}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (passwordOk) go("terms");
          }}
        >
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="form-input text-center text-base pr-16"
              placeholder="••••••••"
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-text-muted hover:text-text-primary"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {password.length > 0 && !passwordOk && (
            <p className="mt-2 text-xs text-text-muted text-center">
              {6 - password.length} more character{6 - password.length === 1 ? "" : "s"}
            </p>
          )}
          <ContinueButton disabled={!passwordOk} />
        </form>
      </AuthShell>
    );
  }

  /* ---------------- THE RULES ---------------- */
  return (
    <AuthShell
      title="One last thing"
      helper="Agree to the rules and your account switches on."
      steps={QUESTION_STEPS.length}
      step={4}
      onBack={() => go("password")}
      error={error}
      footer={footer}
    >
      <form onSubmit={handleSignUp}>
        {/* What they're signing up as — a quiet recap so a typo in
            the email doesn't cost them the confirmation link. */}
        <dl className="mb-4 rounded-lg border border-white/10 bg-black/30 divide-y divide-white/10 text-sm">
          <div className="flex justify-between gap-3 px-3 py-2">
            <dt className="text-text-muted">Email</dt>
            <dd className="text-text-primary truncate">{email.trim()}</dd>
          </div>
          <div className="flex justify-between gap-3 px-3 py-2">
            <dt className="text-text-muted">Username</dt>
            <dd className="text-text-primary truncate">@{username}</dd>
          </div>
        </dl>

        {/* EULA consent — an ACTIVE checkbox, not implied consent.
            App Store 1.2: users must agree to terms that make the
            zero-tolerance policy explicit before registering. */}
        <label className="flex items-start gap-3 p-3 rounded border border-border-medium bg-bg-elevated/40 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--accent-primary,#1e90ff)]"
            autoFocus
          />
          <span className="text-xs text-text-secondary leading-relaxed">
            {/* In-app navigation, NOT target="_blank": the app's
                WKWebView has no tabs, so _blank can silently no-op. */}
            I agree to the{" "}
            <Link href="/terms" className="text-accent-primary hover:underline">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-accent-primary hover:underline">
              Privacy Policy
            </Link>
            , including the{" "}
            <span className="text-text-primary font-medium">zero-tolerance policy</span>{" "}
            for objectionable content and abusive users.
          </span>
        </label>

        <ContinueButton disabled={!agreedToTerms} loading={loading}>
          Create account
        </ContinueButton>
      </form>
    </AuthShell>
  );
}
