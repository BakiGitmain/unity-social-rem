"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserState = {
  username: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const UserContext = createContext<UserState>({ username: null, loading: true, refresh: async () => {} });

/**
 * Who is logged in, for display only (the @username in the menus).
 * Read from the session cookie in the browser, so pages stay static and fast.
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const { data } = await createClient().auth.getSession();
      const name = data.session?.user.user_metadata?.username;
      setUsername(typeof name === "string" ? name : null);
    } catch {
      setUsername(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-check after every navigation (login/signup redirect back with a fresh cookie).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange(() => void refresh());
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo(() => ({ username, loading, refresh }), [username, loading, refresh]);
  return <UserContext value={value}>{children}</UserContext>;
}

export const useUser = () => useContext(UserContext);
