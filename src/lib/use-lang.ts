"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/types";

const KEY = "usr-study-lang";
const EVENT = "usr-lang-change";
const VALID: Lang[] = ["en", "am", "both"];

function read(): Lang {
  try {
    const v = window.localStorage.getItem(KEY) as Lang | null;
    return v && VALID.includes(v) ? v : "en";
  } catch {
    return "en";
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

/** The study-page language, remembered in localStorage (English by default). */
export function useLang(): [Lang, (l: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, read, () => "en" as Lang);
  const setLang = useCallback((l: Lang) => {
    try {
      window.localStorage.setItem(KEY, l);
    } catch {
      // Storage blocked (private mode etc.): the choice just won't be remembered.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [lang, setLang];
}
