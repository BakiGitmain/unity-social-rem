"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-provider";
import { exportInk } from "@/lib/ink/render";
import { hashInk, type InkItem, type WsLayout } from "@/lib/ink/model";
import { idbGet, idbSet } from "@/lib/ink/store";
import { createRecognizer, inkMode, type ExpectKind, type InkStatus, type Recognition } from "@/lib/ink/recognition";

/** Error from /api/handwriting with its code (login_required, off, budget, limit, too_fast, ...). */
export class InkError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

/** Fallback codes: switch to typing with a note. */
export const FALLBACK_CODES = new Set(["login_required", "off", "budget", "limit"]);

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

async function post<T>(body: object): Promise<T> {
  const res = await fetch("/api/handwriting", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new InkError(data.error ?? "error", res.status);
  return data;
}

/** Worksheet: the whole paper (labels printed on it) read in ONE call → one result per label. */
const recognizeParts = createRecognizer<{ image: string; labels: string[]; expects: ExpectKind[] }, Recognition[]>(
  async (p) => (await post<{ result: Recognition[] }>({ mode: "read", ...p })).result,
  { get: (k) => idbGet<Recognition[]>("reads", k), set: (k, v) => idbSet("reads", k, v) },
);

export async function readWorksheet(items: InkItem[], labels: string[], expects: ExpectKind[], layout: WsLayout = "side") {
  const key = `ws:${layout}:${hashInk(items, labels.join("|") + expects.join(","))}`;
  return recognizeParts(key, async () => {
    const ex = await exportInk(items, 768, labels, layout);
    if (!ex) throw new InkError("empty", 400);
    return { image: await blobToBase64(ex.blob), labels, expects };
  });
}

/* ------------------------------------------------------------------ status (handwriting on/off, limits) */

let cached: { at: number; value: Omit<InkStatus, "loggedIn"> } | null = null;

export function useInkStatus(): InkStatus & { loading: boolean; refresh: () => void } {
  const { username, loading: userLoading } = useUser();
  const [s, setS] = useState<Omit<InkStatus, "loggedIn"> | null>(cached?.value ?? null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!username) return;
    if (cached && Date.now() - cached.at < 60_000 && !tick) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setS(cached.value);
      return;
    }
    let stop = false;
    void createClient()
      .rpc("my_ink_status")
      .then(({ data }) => {
        if (stop || !data) return;
        const v = data as { available: boolean; reason: string | null; checks: number; limit: number };
        cached = { at: Date.now(), value: v };
        setS(v);
      });
    return () => {
      stop = true;
    };
  }, [username, tick]);
  return {
    loggedIn: !!username,
    ...(s ?? {}),
    loading: userLoading || (!!username && !s),
    refresh: () => {
      cached = null;
      setTick((t) => t + 1);
    },
  };
}

export { inkMode };
