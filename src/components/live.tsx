"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { createPoller, createSubscription, type LiveDeps } from "@/lib/live/controller";

/* Live updates for the whole site: Supabase Realtime (RLS-filtered) + background polling.
   Both pause while the tab is hidden and are cleaned up on unmount (see src/lib/live/controller.ts). */

const browserDeps: LiveDeps = {
  isVisible: () => typeof document === "undefined" || document.visibilityState === "visible",
  onVisibilityChange: (cb) => {
    document.addEventListener("visibilitychange", cb);
    return () => document.removeEventListener("visibilitychange", cb);
  },
  setInterval: (fn, ms) => window.setInterval(fn, ms),
  clearInterval: (id) => window.clearInterval(id as number),
  now: () => Date.now(),
};

export type RealtimeSpec = { table: string; event?: "INSERT" | "UPDATE" | "DELETE" | "*"; filter?: string };

/** Runs `task` every `ms` while the tab is visible (catches up when it becomes visible again). */
export function usePolling(task: () => void, ms = 60_000, enabled = true) {
  const ref = useRef(task);
  useEffect(() => {
    ref.current = task;
  }, [task]);
  useEffect(() => {
    if (!enabled) return;
    const p = createPoller(() => ref.current(), ms, browserDeps);
    p.start();
    return () => p.stop();
  }, [ms, enabled]);
}

/**
 * Subscribes to row changes of `specs` while the tab is visible. One channel per hook, removed on unmount.
 * `onResume` runs when the tab becomes visible again (changes may have been missed meanwhile).
 */
export function useRealtime(
  key: string,
  specs: RealtimeSpec[],
  onChange: (p: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  opts: { enabled?: boolean; onStatus?: (connected: boolean) => void; onResume?: () => void } = {},
) {
  const cb = useRef(onChange);
  const statusCb = useRef(opts.onStatus);
  const resumeCb = useRef(opts.onResume);
  useEffect(() => {
    cb.current = onChange;
    statusCb.current = opts.onStatus;
    resumeCb.current = opts.onResume;
  });
  const enabled = opts.enabled ?? true;
  const specKey = JSON.stringify(specs);

  useEffect(() => {
    if (!enabled) return;
    const list = JSON.parse(specKey) as RealtimeSpec[];
    const sub = createSubscription(
      () => {
        const supabase = createClient();
        const channel = supabase.channel(`${key}:${Math.random().toString(36).slice(2, 10)}`);
        for (const s of list) {
          channel.on(
            "postgres_changes" as never,
            { event: s.event ?? "*", schema: "public", table: s.table, ...(s.filter ? { filter: s.filter } : {}) } as never,
            ((p: RealtimePostgresChangesPayload<Record<string, unknown>>) => cb.current(p)) as never,
          );
        }
        channel.subscribe((status) => statusCb.current?.(status === "SUBSCRIBED"));
        return () => {
          statusCb.current?.(false);
          void supabase.removeChannel(channel);
        };
      },
      browserDeps,
      () => resumeCb.current?.(),
    );
    sub.start();
    return () => sub.stop();
  }, [key, specKey, enabled]);
}

/**
 * Local state that follows a server prop: when the server sends new data (router.refresh, revalidatePath after
 * an action, polling), the local copy is replaced. Local edits in between (optimistic changes) are kept.
 */
export function useServerState<T>(value: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setState(value);
  }
  return [state, setState];
}

/* ---------------- admin live status ("● Live · Updated just now") ---------------- */

type LiveStatus = { lastUpdated: number | null; connected: boolean; markUpdated: () => void; setConnected: (c: boolean) => void };
const LiveCtx = createContext<LiveStatus>({ lastUpdated: null, connected: false, markUpdated: () => {}, setConnected: () => {} });

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [lastUpdated, setLast] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const markUpdated = useCallback(() => setLast(Date.now()), []);
  const value = useMemo(() => ({ lastUpdated, connected, markUpdated, setConnected }), [lastUpdated, connected, markUpdated]);
  return <LiveCtx value={value}>{children}</LiveCtx>;
}

export const useLiveStatus = () => useContext(LiveCtx);

/**
 * Keeps the current (server-rendered) admin page fresh without a reload:
 * realtime changes on `tables` → a debounced router.refresh(); plus a quiet refresh every `pollMs`.
 * router.refresh() keeps the current UI on screen until the new data arrives (no loading flicker).
 */
export function useLiveRefresh({
  key,
  tables = [],
  pollMs = 60_000,
  debounceMs = 700,
}: {
  key: string;
  tables?: string[];
  pollMs?: number;
  debounceMs?: number;
}) {
  const router = useRouter();
  const { markUpdated, setConnected } = useLiveStatus();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(() => {
    router.refresh();
    markUpdated();
  }, [router, markUpdated]);

  const soon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(refresh, debounceMs);
  }, [refresh, debounceMs]);
  useEffect(() => () => clearTimeout(timer.current), []);

  usePolling(refresh, pollMs || 60_000, pollMs > 0);
  useRealtime(
    key,
    tables.map((table) => ({ table })),
    soon,
    { enabled: tables.length > 0, onStatus: setConnected, onResume: soon },
  );
}
