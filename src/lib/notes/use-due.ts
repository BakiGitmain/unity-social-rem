"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/components/user-provider";

const EVENT = "usr-notes-due-change";
/** Tell the badges to refresh (after a review or a new flashcard). */
export const notifyDue = () => window.dispatchEvent(new Event(EVENT));

/** Flashcards due today (badge on the Notes tab). Loaded lazily, refreshed on focus and after reviews. */
export function useDueCount(): number {
  const { username, loading } = useUser();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (loading) return;
    let stop = false;
    const load = () =>
      void import("@/lib/notes/client").then(({ dueCount }) =>
        dueCount(!!username)
          .then((c) => !stop && setN(c))
          .catch(() => {}),
      );
    load();
    window.addEventListener(EVENT, load);
    window.addEventListener("focus", load);
    return () => {
      stop = true;
      window.removeEventListener(EVENT, load);
      window.removeEventListener("focus", load);
    };
  }, [username, loading]);
  return n;
}
