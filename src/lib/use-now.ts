"use client";

import { useEffect, useState } from "react";
import { parseAddisLocal } from "@/lib/time/clock";

const FAKE_KEY = "usr-fake-now";

/**
 * Dev only: `?now=2026-11-11T14:45` (Addis Ababa local time) fakes the current time.
 * It keeps ticking from there and is remembered for this tab while you navigate; `?now=off` clears it.
 */
function fakeOffset(): number {
  if (process.env.NODE_ENV === "production") return 0;
  try {
    const q = new URLSearchParams(window.location.search).get("now");
    if (q === "off") {
      window.sessionStorage.removeItem(FAKE_KEY);
      return 0;
    }
    if (q) {
      const ms = parseAddisLocal(q);
      if (ms !== null) {
        const offset = ms - Date.now();
        window.sessionStorage.setItem(FAKE_KEY, String(offset));
        return offset;
      }
    }
    const saved = Number(window.sessionStorage.getItem(FAKE_KEY));
    return Number.isFinite(saved) ? saved : 0;
  } catch {
    return 0;
  }
}

/** Whether the current page uses a faked dev time (`?now=`). Set when the clock starts. */
let fakeActive = false;
export const isFakeTime = () => fakeActive;

/** Current time (epoch ms), ticking every second on the second. `null` until mounted (avoids hydration mismatch). */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const offset = fakeOffset();
    fakeActive = Math.abs(offset) > 5000;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Date.now() + offset;
      setNow(t);
      timer = setTimeout(tick, 1000 - (t % 1000) + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  return now;
}
