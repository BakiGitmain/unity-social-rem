"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { pingSeen } from "@/lib/track";

type UserState = {
  username: string | null;
  /** Has the admin role (display only: the admin area checks this again on the server, with 2FA). */
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const UserContext = createContext<UserState>({ username: null, isAdmin: false, loading: true, refresh: async () => {} });

/**
 * Who is logged in, for display only (the @username in the menus).
 * Read from the session cookie in the browser, so pages stay static and fast.
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // A deleted account can still have a valid session cookie for a while: if its profile is gone,
        // sign out on this device and go to the login page instead of showing it as logged in.
        const [profile, admin] = await Promise.all([
          supabase.from("profiles").select("id").eq("id", data.session.user.id).maybeSingle(),
          supabase.rpc("has_admin_role"),
        ]);
        if (!profile.error && !profile.data) {
          await supabase.auth.signOut({ scope: "local" });
          setUsername(null);
          setIsAdmin(false);
          if (!/\/login$/.test(window.location.pathname)) router.replace("/login");
          return;
        }
        const name = data.session.user.user_metadata?.username;
        setUsername(typeof name === "string" ? name : null);
        pingSeen();
        setIsAdmin(admin.data === true);
      } else {
        setUsername(null);
        setIsAdmin(false);
      }
    } catch {
      setUsername(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Re-check after every navigation (login/signup redirect back with a fresh cookie).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange(() => void refresh());
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo(() => ({ username, isAdmin, loading, refresh }), [username, isAdmin, loading, refresh]);
  return <UserContext value={value}>{children}</UserContext>;
}

export const useUser = () => useContext(UserContext);
