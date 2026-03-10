"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/database";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());

  const fetchProfile = useCallback(async (userId: string) => {
    console.log("[Auth Debug] fetchProfile called for:", userId);
    const { data, error } = await supabaseRef.current
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    console.log("[Auth Debug] fetchProfile result:", {
      hasData: !!data,
      error: error?.message,
      username: (data as Profile | null)?.username,
    });

    setProfile(data as Profile | null);
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;

    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // Use ONLY onAuthStateChange — it fires INITIAL_SESSION first,
    // then TOKEN_REFRESHED, SIGNED_IN, SIGNED_OUT, etc.
    // This eliminates the race condition between getSession() and the listener.
    // Also try getSession directly to see what's available
    supabase.auth.getSession().then(({ data, error }) => {
      console.log("[Auth Debug] getSession result:", {
        hasSession: !!data.session,
        userId: data.session?.user?.id,
        expiresAt: data.session?.expires_at,
        error: error?.message,
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth Debug] onAuthStateChange:", {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
      });
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabaseRef.current.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
