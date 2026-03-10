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
  const profileCache = useRef<Record<string, Profile | null>>({});

  const fetchProfile = useCallback(async (userId: string) => {
    // Check cache first to avoid redundant queries
    if (profileCache.current[userId] !== undefined) {
      setProfile(profileCache.current[userId]);
      return;
    }

    const { data } = await supabaseRef.current
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    const p = data as Profile | null;
    profileCache.current[userId] = p;
    setProfile(p);
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        // Invalidate cache on sign-in so we get fresh profile data
        if (event === "SIGNED_IN") {
          delete profileCache.current[currentUser.id];
        }
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
    profileCache.current = {};
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
