"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Panel */}
        <div className="bg-[#1e1e22] border border-white/10 rounded-lg p-8 shadow-[0_0_40px_rgba(30,144,255,0.08)]">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#e8e6e3] font-[family-name:var(--font-space-grotesk)] mb-2">
              Sign In
            </h1>
            <p className="text-[#9a9a9e] text-sm">
              Welcome back to Peak Music Reviews
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
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
                className="w-full px-4 py-3 rounded bg-[#0a0a0c] border border-white/10 text-[#e8e6e3] placeholder:text-[#5a5a60] focus:outline-none focus:border-[#1e90ff]/50 focus:ring-1 focus:ring-[#1e90ff]/30 transition-colors"
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded font-bold text-sm uppercase tracking-wider bg-[#1e90ff] hover:bg-[#1e90ff]/80 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-space-grotesk)]"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-[#9a9a9e]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#1e90ff] hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
