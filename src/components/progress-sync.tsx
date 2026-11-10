"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/components/user-provider";
import { mergeWithServer, setProgressSync } from "@/lib/progress";

/** While logged in, progress is also saved to Supabase; on login, local and account progress are merged. */
export function ProgressSync() {
  const { username, loading } = useUser();
  const merged = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    setProgressSync(!!username);
    if (username && merged.current !== username) {
      merged.current = username;
      void mergeWithServer();
    }
    if (!username) merged.current = null;
  }, [username, loading]);

  return null;
}
