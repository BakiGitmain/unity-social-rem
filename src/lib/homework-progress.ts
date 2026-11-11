"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { isProgressSyncOn } from "@/lib/progress";

/**
 * Homework progress per lesson: which exercises are done + the last answer to each answer box.
 * Always in localStorage; when logged in also in `homework_progress` (own row, RLS), merged on open.
 */
export type SavedAnswer = { input: string; correct: boolean; value: number | string[] | null; chosen: number | null };
export type HomeworkProgress = { done: string[]; answers: Record<string, SavedAnswer> };

const EMPTY: HomeworkProgress = { done: [], answers: {} };
const EVENT = "usr-homework-change";
const key = (lessonId: string) => `usr-homework:${lessonId}`;

function readRaw(lessonId: string) {
  try {
    return window.localStorage.getItem(key(lessonId)) ?? "";
  } catch {
    return "";
  }
}

function parse(raw: string): HomeworkProgress {
  if (!raw) return EMPTY;
  try {
    const p = JSON.parse(raw) as Partial<HomeworkProgress>;
    return {
      done: Array.isArray(p.done) ? [...new Set(p.done.filter((x) => typeof x === "string"))] : [],
      answers: p.answers && typeof p.answers === "object" ? p.answers : {},
    };
  } catch {
    return EMPTY;
  }
}

function writeLocal(lessonId: string, p: HomeworkProgress) {
  try {
    window.localStorage.setItem(key(lessonId), JSON.stringify(p));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Debounced save to Supabase (one write per burst of changes). */
function pushToServer(lessonId: string) {
  if (!isProgressSyncOn()) return;
  clearTimeout(timers.get(lessonId));
  timers.set(
    lessonId,
    setTimeout(async () => {
      const p = parse(readRaw(lessonId));
      try {
        await createClient()
          .from("homework_progress")
          .upsert({ lesson_id: lessonId, done: p.done, answers: p.answers, updated_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
      } catch {
        // offline: kept locally and merged next time
      }
    }, 800),
  );
}

/** Union of done exercises; a correct answer wins over a wrong one. */
function merge(a: HomeworkProgress, b: HomeworkProgress): HomeworkProgress {
  const answers = { ...b.answers };
  for (const [k, v] of Object.entries(a.answers)) if (!answers[k] || (v.correct && !answers[k]!.correct)) answers[k] = v;
  return { done: [...new Set([...a.done, ...b.done])], answers };
}

export function useHomeworkProgress(lessonId: string, loggedIn: boolean) {
  const raw = useSyncExternalStore(subscribe, () => readRaw(lessonId), () => "");
  const progress = useMemo(() => parse(raw), [raw]);

  // Logged in: merge the account's progress with this device's once.
  useEffect(() => {
    if (!loggedIn) return;
    let stop = false;
    void (async () => {
      const { data } = await createClient().from("homework_progress").select("done, answers").eq("lesson_id", lessonId).maybeSingle();
      if (stop) return;
      const local = parse(readRaw(lessonId));
      const merged = data ? merge(local, { done: (data.done as string[]) ?? [], answers: (data.answers as HomeworkProgress["answers"]) ?? {} }) : local;
      writeLocal(lessonId, merged);
      if (merged.done.length || Object.keys(merged.answers).length) pushToServer(lessonId);
    })();
    return () => {
      stop = true;
    };
  }, [lessonId, loggedIn]);

  const update = useCallback(
    (fn: (p: HomeworkProgress) => HomeworkProgress) => {
      writeLocal(lessonId, fn(parse(readRaw(lessonId))));
      pushToServer(lessonId);
    },
    [lessonId],
  );
  return [progress, update] as const;
}
