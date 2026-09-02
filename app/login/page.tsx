"use client";

/**
 * /login — sign in, one question per screen (Luca 2026-09-02).
 *
 * Screens: the door (Google / Apple / email) → who are you (email or
 * username) → password → [staff only] the emailed code.
 *
 * Two flows live here, unchanged underneath:
 *
 * 1. Normal accounts: email/username + password, done.
 *
 * 2. Staff accounts (role admin/owner — Luca 2026-08-25): the
 *    password alone is deliberately NOT enough. After the password
 *    checks out we throw the session away, email a 6-digit code, and
 *    only verifyOtp() mints the session that admin tools accept
 *    (middleware + /api/admin + Postgres all check HOW the session
 *    was created — see lib/auth/amr.ts). A stolen admin password
 *    without inbox access gets nobody into the mod tools.
 *
 * Also handled: someone signs up, never clicks the confirmation
 * email, then tries to log in. Supabase answers "Email not confirmed"
 * — we turn that into a clear message plus a one-click resend (with a
 * cooldown so it can't be spammed).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import OAuthButtons from "@/components/auth/OAuthButtons";
import AuthShell, { ContinueButton, OrRule } from "@/components/auth/AuthShell";
import type { Profile } from "@/lib/types/database";

type Step = "door" | "identifier" | "password" | "code";
/** Dots only cover the two questions everyone answers; the staff
    code screen rides as a third dot when it appears. */
const DOTS = 2;

export default function LoginPage() {
  const [step, setStep] = useState<Step>("door");
  // Email OR username (Luca 2026-08-22) — never display name.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // The address the sign-in actually ran against — a username entry
  // resolves to this; the confirmation-resend and the admin code
  // step both need it.
  const [resolvedEmail, setResolvedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  // Set when the middleware bounced an admin here (?verify=admin):
  // their session predates the code requirement.
  const [adminNotice, setAdminNotice] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ?verify=admin / ?error=oauth — read from the raw URL instead of
  // useSearchParams so this client page needs no Suspense boundary.
  // ?error=oauth means a Google/Apple hand-back failed (a plain
  // cancel comes back clean, with nothing to explain).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verify") === "admin") setAdminNotice(true);
    if (params.get("error") === "oauth") {
      setError(
        "That sign-in didn't come back through — try again, or use your email and password."
      );
    }
  }, []);

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  const identifierOk = identifier.trim().length > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsConfirmation(false);
    setLoading(true);

    const supabase = createClient();

    // "@" means it's an email; anything else is treated as a
    // username and resolved server-side (migration 017's
    // email_for_login — it only answers when the password is right,
    // so usernames can't be turned into emails).
    // Lowercased because the 6-digit code is verified by hashing
    // code+email together — "Vince@" vs "vince@" makes every code
    // read as wrong, while the emailed LINK (token-hash only)
    // still works (Luca 2026-08-26: exactly that symptom).
    let email = identifier.trim().toLowerCase();
    if (!email.includes("@")) {
      const { data: resolved } = await supabase.rpc("email_for_login", {
        identifier: email,
        pass: password,
      } as never);
      if (!resolved) {
        setError("Wrong username or password.");
        setLoading(false);
        return;
      }
      email = resolved as string;
    }
    setResolvedEmail(email);

    const { data: signInData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      // Unconfirmed inbox gets its own path with a resend button.
      if (/email not confirmed/i.test(authError.message)) {
        setNeedsConfirmation(true);
      } else if (/invalid login credentials/i.test(authError.message)) {
        setError("Wrong email/username or password.");
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    // --- Staff detour: password OK, now prove the inbox ---
    const userId = signInData.user?.id;
    if (userId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      const role = (profileData as Pick<Profile, "role"> | null)?.role;

      if (role === "owner" || role === "admin") {
        // Drop the password-only session — locally, so other devices
        // stay signed in — then email the code. verifyOtp() below is
        // what actually signs a staff member in.
        await supabase.auth.signOut({ scope: "local" });

        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (otpError) {
          // Most likely Supabase's email rate limit.
          setError(
            "Password OK, but the sign-in code couldn't be sent — wait a minute and try again."
          );
          setLoading(false);
          return;
        }

        go("code");
        setResendCooldown(60);
        setLoading(false);
        return;
      }
    }

    router.push("/");
    router.refresh();
  };

  // Step (staff only): the emailed 6-digit code → real session.
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: resolvedEmail,
      token: code.trim(),
      type: "email",
    });

    if (verifyError) {
      // Only staff ever see this screen, so show Supabase's real
      // reason next to the friendly line — "expired", "invalid",
      // rate-limited, etc. — instead of leaving them (and us)
      // guessing which one it was.
      setError(
        `Wrong or expired code — check the newest email. (${verifyError.message})`
      );
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !resolvedEmail) return;
    setResendNote(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: resolvedEmail,
      options: { shouldCreateUser: false },
    });
    setResendNote(
      resendError
        ? "Couldn't resend — wait a minute and try again."
        : "New code sent. Only the newest one works."
    );
    setResendCooldown(60);
  };

  const handleResend = async () => {
    const email = resolvedEmail || (identifier.includes("@") ? identifier.trim() : "");
    if (resendCooldown > 0 || !email) return;
    setResendNote(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResendNote(
      resendError
        ? "Couldn't resend — wait a minute and try again."
        : "Confirmation link re-sent. Check spam too."
    );
    setResendCooldown(60);
  };

  const footer = (
    <>
      Don&apos;t have an account?{" "}
      <Link href="/signup" className="text-accent-primary hover:text-accent-glow hover:underline">
        Sign up
      </Link>
    </>
  );

  /* ---------------- STAFF CODE ---------------- */
  if (step === "code") {
    return (
      <AuthShell
        title="Check your email"
        helper={
          <>
            Admin accounts need the sign-in code we just sent to{" "}
            <span className="text-text-primary">{resolvedEmail}</span>.
          </>
        }
        steps={DOTS + 1}
        step={DOTS}
        onBack={() => {
          go("password");
          setCode("");
        }}
        error={error}
      >
        <form onSubmit={handleVerifyCode}>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="form-input text-center tracking-[0.5em] text-lg"
            placeholder="00000000"
            /* Supabase's OTP length is a dashboard setting (6–10
               digits) and this project sends 8 — accept the range. */
            maxLength={10}
            autoFocus
          />
          <ContinueButton disabled={code.trim().length < 6} loading={loading}>
            Verify
          </ContinueButton>
        </form>

        <div className="mt-5 space-y-2 text-center text-sm">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resendCooldown > 0}
            className="text-text-secondary hover:text-accent-primary transition-colors disabled:opacity-50"
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
          </button>
          {resendNote && <p className="pixel-text text-accent-glow">{resendNote}</p>}
        </div>
      </AuthShell>
    );
  }

  /* ---------------- THE DOOR ---------------- */
  if (step === "door") {
    return (
      <AuthShell
        title="Welcome back"
        helper="Sign in to Peak Music Reviews."
        error={error}
        footer={footer}
      >
        {/* Middleware sent an admin here for the code upgrade */}
        {adminNotice && (
          <div className="mb-4 p-3 rounded bg-accent-primary/10 border border-accent-primary/30 text-sm text-text-primary">
            Admin tools now need a sign-in verified by email code. Sign in
            again and we&apos;ll send you one.
          </div>
        )}

        {/* One-tap doors. Renders nothing inside a 1.0 app shell —
            see components/auth/OAuthButtons. */}
        <OAuthButtons />
        <OrRule />
        <button
          type="button"
          onClick={() => go("identifier")}
          className="btn-y2k btn-y2k-primary w-full justify-center"
        >
          Continue with email
        </button>
      </AuthShell>
    );
  }

  /* ---------------- WHO ARE YOU ---------------- */
  if (step === "identifier") {
    return (
      <AuthShell
        title="Enter your email"
        helper="Or your username — either one works."
        steps={DOTS}
        step={0}
        onBack={() => go("door")}
        error={error}
        footer={footer}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (identifierOk) go("password");
          }}
        >
          <input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            className="form-input text-center text-base"
            placeholder="you@example.com or username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
          />
          <ContinueButton disabled={!identifierOk} />
        </form>
      </AuthShell>
    );
  }

  /* ---------------- PASSWORD ---------------- */
  return (
    <AuthShell
      title="Enter your password"
      helper={
        <>
          Signing in as{" "}
          <span className="text-text-primary font-medium">{identifier.trim()}</span>
        </>
      }
      steps={DOTS}
      step={1}
      onBack={() => {
        go("identifier");
        setNeedsConfirmation(false);
      }}
      error={error}
      footer={footer}
    >
      {/* Unconfirmed email — explain + offer a resend */}
      {needsConfirmation && (
        <div className="mb-4 p-4 rounded bg-osd-amber/10 border border-osd-amber/30 space-y-3">
          <p className="text-sm text-text-primary">
            This account hasn&apos;t been switched on yet — the confirmation
            link in your inbox does that.
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="btn-y2k btn-y2k-outline text-xs disabled:opacity-50"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend confirmation link"}
          </button>
          {resendNote && (
            <p className="pixel-text text-sm text-accent-glow">{resendNote}</p>
          )}
        </div>
      )}

      <form onSubmit={handleLogin}>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="form-input text-center text-base pr-16"
            placeholder="••••••••"
            autoComplete="current-password"
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
        <p className="mt-2 text-right">
          <Link
            href="/forgot-password"
            className="text-xs text-text-muted hover:text-accent-primary transition-colors"
          >
            Forgot it?
          </Link>
        </p>

        <ContinueButton disabled={password.length === 0} loading={loading}>
          Sign in
        </ContinueButton>

        {/* App Store 1.2 says the EULA is presented "before
            registering or logging in" — signup has the required
            checkbox; login carries the agreement notice so the
            reviewer's demo-account path sees it too. */}
        <p className="mt-4 text-[11px] text-text-muted text-center leading-relaxed">
          By signing in you agree to the{" "}
          <Link href="/terms" className="text-accent-primary hover:underline">
            Terms of Use
          </Link>{" "}
          — zero tolerance for objectionable content or abusive users — and
          the{" "}
          <Link href="/privacy" className="text-accent-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
