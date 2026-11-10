"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { TimeFormat } from "@/lib/time/clock";

const KEY = "usr-time-format";
const EVENT = "usr-time-format-change";
const VALID: TimeFormat[] = ["12h", "24h", "eth"];

function read(): TimeFormat {
  try {
    const v = window.localStorage.getItem(KEY) as TimeFormat | null;
    return v && VALID.includes(v) ? v : "12h";
  } catch {
    return "12h";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Clock format: 12-hour (default), 24-hour or Ethiopian. Remembered in localStorage. */
export function useTimeFormat(): [TimeFormat, (f: TimeFormat) => void] {
  const format = useSyncExternalStore(subscribe, read, () => "12h" as TimeFormat);
  const set = useCallback((f: TimeFormat) => {
    try {
      window.localStorage.setItem(KEY, f);
    } catch {
      // storage blocked: the choice just won't be remembered
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [format, set];
}
