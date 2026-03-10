"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/;

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const validateUsername = (value: string) => {
    const lower = value.toLowerCase();
    setUsername(lower);

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
      setUsernameError(
        "Only lowercase letters, numbers, and hyphens. Must start and end with a letter or number."
      );
      return;
    }
    setUsernameError(null);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (usernameError) return;
    if (!USERNAME_REGEX.test(username)) {
      setUsernameError("Please enter a valid username");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: username,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is enabled, show success. Otherwise redirect.
    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-[#1e1e22] border border-white/10 rounded-lg p-8 shadow-[0_0_40px_rgba(30,144,255,0.08)] text-center">
            <div className="w-16 h-16 rounded-full bg-[#1e90ff]/15 border border-[#1e90ff]/30 flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-[#1e90ff]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#e8e6e3] font-[family-name:var(--font-space-grotesk)] mb-3">
              Check Your Email
            </h2>
            <p className="text-[#9a9a9e] text-sm mb-6">
              We sent a confirmation link to{" "}
              <span className="text-[#e8e6e3]">{email}</span>. Click it to
              activate your account.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="px-6 py-2 rounded font-bold text-sm uppercase tracking-wider bg-[#1e90ff] hover:bg-[#1e90ff]/80 text-white transition-colors font-[family-name:var(--font-space-grotesk)]"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Panel */}
        <div className="bg-[#1e1e22] border border-white/10 rounded-lg p-8 shadow-[0_0_40px_rgba(30,144,255,0.08)]">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#e8e6e3] font-[family-name:var(--font-space-grotesk)] mb-2">
              Create Account
            </h1>
            <p className="text-[#9a9a9e] text-sm">
              Join Peak Music Reviews
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
                className="block text-xs font-bold uppercase tracking-wider text-[#9a9a9e] mb-2 font-[family-name:var(--font-space-grotesk)]"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => validateUsername(e.target.value)}
                required
                className="w-full px-4 py-3 rounded bg-[#0a0a0c] border border-white/10 text-[#e8e6e3] placeholder:text-[#5a5a60] focus:outline-none focus:border-[#1e90ff]/50 focus:ring-1 focus:ring-[#1e90ff]/30 transition-colors"
                placeholder="your-username"
              />
              {usernameError && (
                <p className="mt-1.5 text-xs text-red-400">{usernameError}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-[#9a9a9e] mb-2 font-[family-name:var(--font-space-grotesk)]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded bg-[#0a0a0c] border border-white/10 text-[#e8e6e3] placeholder:text-[#5a5a60] focus:outline-none focus:border-[#1e90ff]/50 focus:ring-1 focus:ring-[#1e90ff]/30 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-[#9a9a9e] mb-2 font-[family-name:var(--font-space-grotesk)]"
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
                className="w-full px-4 py-3 rounded bg-[#0a0a0c] border border-white/10 text-[#e8e6e3] placeholder:text-[#5a5a60] focus:outline-none focus:border-[#1e90ff]/50 focus:ring-1 focus:ring-[#1e90ff]/30 transition-colors"
                placeholder="At least 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !!usernameError}
              className="w-full py-3 rounded font-bold text-sm uppercase tracking-wider bg-[#1e90ff] hover:bg-[#1e90ff]/80 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-space-grotesk)]"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-[#9a9a9e]">
            Already have an account?{" "}
            <Link href="/login" className="text-[#1e90ff] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
