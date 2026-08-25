import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionUsedEmailCode } from "@/lib/auth/amr";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth session — important for Server Components.
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Defense-in-depth route gating ---
  // Pages and API routes each check auth themselves; this is a second layer
  // so a forgotten check in a page doesn't become a hole.
  const path = request.nextUrl.pathname;

  const protectedPrefixes = [
    "/settings",
    "/admin",
    "/reviews/new",
    "/reviews/mine",
    "/lists/new",
    "/debates/new",
    "/posts/new",
    "/connections",
  ];

  if (!user) {
    // Admin API calls get a JSON 401 instead of a redirect.
    if (path.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (protectedPrefixes.some((p) => path === p || path.startsWith(p + "/"))) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- Admin email-code gate (Luca 2026-08-25) ---
  // Admin tools need a session that went through the emailed 6-digit
  // code, not just a password (see lib/auth/amr.ts for the why).
  // Only admin paths pay for the extra role lookup; everyone else
  // skips this block entirely.
  const isAdminPath =
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/api/admin");

  if (user && isAdminPath) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profileData as { role?: string } | null)?.role;

    if (role === "owner" || role === "admin") {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!sessionUsedEmailCode(session?.access_token)) {
        if (path.startsWith("/api/admin")) {
          return NextResponse.json(
            { error: "Sign in again with your email code to use admin tools." },
            { status: 403 }
          );
        }
        // Page visit → bounce to login, which explains the situation
        // (?verify=admin) and runs the code flow on the next sign-in.
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.search = "?verify=admin";
        return NextResponse.redirect(loginUrl);
      }
    }
    // Non-admins fall through — the pages/routes 403 them themselves.
  }

  return supabaseResponse;
}
