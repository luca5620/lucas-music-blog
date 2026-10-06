import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionUsedEmailCode } from "@/lib/auth/amr";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  // --- Old-style signup links (2026-10-05) ---
  // Until 2026-10-05 the signup confirmation email pointed at the bare
  // site root, so the link arrived as "/?code=…" and only the BROWSER
  // client could exchange it — the page rendered logged-out until a
  // refresh, and in another browser (Gmail's in-app one) it silently
  // failed. Signup now points at /auth/confirm, but emails already
  // sitting in inboxes (and Supabase's fallback to the Site URL when a
  // redirect isn't allow-listed) still land here. Hand the code to
  // the server route, which sets the session cookies properly and
  // carries on to the first-rating screen (it bounces anyone who
  // isn't new straight on to the home page). Nothing else on the
  // site puts a ?code= on the home page.
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const confirmUrl = request.nextUrl.clone();
    confirmUrl.pathname = "/auth/confirm";
    confirmUrl.search = "";
    confirmUrl.searchParams.set("code", request.nextUrl.searchParams.get("code")!);
    confirmUrl.searchParams.set("next", "/start");
    return NextResponse.redirect(confirmUrl);
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
    "/aux-wars/new",
    "/posts/new",
    "/connections",
    // Social-login handle picker — only ever reachable signed in.
    "/welcome",
  ];

  if (!user) {
    // Admin API calls get a JSON 401 instead of a redirect.
    if (path.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (protectedPrefixes.some((p) => path === p || path.startsWith(p + "/"))) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      // Carry where they were going (2026-10-05), so signing in lands
      // them back there — and so /login knows they came from a gated
      // feature and says "sign in to continue" instead of greeting a
      // first-time visitor with "Welcome back".
      loginUrl.search = "";
      loginUrl.searchParams.set("next", path + request.nextUrl.search);
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
