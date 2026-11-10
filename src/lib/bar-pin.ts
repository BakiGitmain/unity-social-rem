"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Lets a screen keep the mobile tab bar visible (no hide-on-scroll), e.g. while a quiz runs
 * or on the "Lesson complete" screen. Any number of screens can pin at once.
 */
const pins = new Set<symbol>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useBarPinned(): boolean {
  return useSyncExternalStore(subscribe, () => pins.size > 0, () => false);
}

/** While `active` is true, the tab bar stays visible. */
export function usePinBar(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const id = Symbol("pin");
    pins.add(id);
    emit();
    return () => {
      pins.delete(id);
      emit();
    };
  }, [active]);
}
