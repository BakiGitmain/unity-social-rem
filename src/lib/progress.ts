"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Lesson progress.
 * - Always saved in localStorage (instant, works logged out).
 * - When logged in, every change is also saved to Supabase (`save_lesson_progress`, which keeps the higher
 *   values), and on login the two are merged, so progress follows the student across devices.
 */
export type LessonProgress = {
  done: number[]; // finished part indices
  part: number; // part to resume at (this device only)
  complete: boolean;
  total: number; // number of parts when last saved
  bestScore: number | null;
  bestTotal: number | null;
};

const EMPTY: LessonProgress = { done: [], part: 0, complete: false, total: 0, bestScore: null, bestTotal: null };
const EVENT = "usr-progress-change";
const PREFIX = "usr-progress:";
const key = (lessonId: string) => `${PREFIX}${lessonId}`;

/* ---------------- local storage ---------------- */

function readRaw(lessonId: string): string {
  try {
    return window.localStorage.getItem(key(lessonId)) ?? "";
  } catch {
    return "";
  }
}

const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : null);

function parse(raw: string): LessonProgress {
  if (!raw) return EMPTY;
  try {
    const p = JSON.parse(raw) as Partial<LessonProgress>;
    return {
      done: Array.isArray(p.done) ? [...new Set(p.done.filter((n) => Number.isInteger(n) && n >= 0))] : [],
      part: int(p.part) ?? 0,
      complete: p.complete === true,
      total: int(p.total) ?? 0,
      bestScore: int(p.bestScore),
      bestTotal: int(p.bestTotal),
    };
  } catch {
    return EMPTY;
  }
}

function writeLocal(lessonId: string, p: LessonProgress) {
  try {
    window.localStorage.setItem(key(lessonId), JSON.stringify(p));
  } catch {
    // storage blocked: progress just won't be saved on this device
  }
  window.dispatchEvent(new Event(EVENT));
}

export function readLessonProgress(lessonId: string): LessonProgress {
  return parse(readRaw(lessonId));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** 0–100. Parts finished ÷ total parts; 100 once the lesson is complete. */
export function percentOf(p: LessonProgress, totalParts: number): number {
  if (p.complete) return 100;
  const total = totalParts || p.total;
  if (!total) return 0;
  return Math.min(100, Math.round((p.done.filter((i) => i < total).length / total) * 100));
}

/** Keep the higher value of two progress records. */
function merge(a: LessonProgress, b: LessonProgress): LessonProgress {
  const aBetter = a.bestScore !== null && (b.bestScore === null || a.bestScore >= b.bestScore);
  return {
    done: [...new Set([...a.done, ...b.done])].sort((x, y) => x - y),
    part: a.part || b.part,
    complete: a.complete || b.complete,
    total: Math.max(a.total, b.total),
    bestScore: aBetter ? a.bestScore : b.bestScore,
    bestTotal: aBetter ? a.bestTotal : b.bestTotal,
  };
}

/* ---------------- server sync (logged-in users) ---------------- */

let syncEnabled = false;

/** Turned on by <ProgressSync> while a user is logged in. */
export function setProgressSync(on: boolean) {
  syncEnabled = on;
}

async function pushToServer(lessonId: string, p: LessonProgress) {
  if (!syncEnabled) return;
  try {
    await createClient().rpc("save_lesson_progress", {
      p_lesson_id: lessonId,
      p_parts_done: p.done,
      p_total_parts: p.total,
      p_completed: p.complete,
      p_quiz_score: p.bestScore,
      p_quiz_total: p.bestTotal,
    });
  } catch {
    // offline: local progress is kept and merged again at the next login
  }
}

/** On login: merge this device's progress with the account's progress (higher wins), both ways. */
export async function mergeWithServer() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("lesson_id, parts_done, total_parts, completed_at, best_quiz_score, best_quiz_total");
  if (error || !data) return;

  const server = new Map<string, LessonProgress>(
    data.map((r) => [
      r.lesson_id as string,
      {
        done: (r.parts_done as number[]) ?? [],
        part: 0,
        complete: !!r.completed_at,
        total: (r.total_parts as number) ?? 0,
        bestScore: (r.best_quiz_score as number | null) ?? null,
        bestTotal: (r.best_quiz_total as number | null) ?? null,
      },
    ]),
  );

  const localIds: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX)) localIds.push(k.slice(PREFIX.length));
    }
  } catch {
    // storage blocked
  }

  for (const id of new Set([...localIds, ...server.keys()])) {
    const local = readLessonProgress(id);
    const merged = merge(local, server.get(id) ?? EMPTY);
    writeLocal(id, merged);
    if (localIds.includes(id)) await pushToServer(id, merged);
  }
}

/* ---------------- hooks & actions ---------------- */

export function saveProgress(lessonId: string, fn: (p: LessonProgress) => LessonProgress) {
  const nextP = fn(readLessonProgress(lessonId));
  writeLocal(lessonId, nextP);
  void pushToServer(lessonId, nextP);
}

/** Remember the best quiz score for a lesson. */
export function recordQuizScore(lessonId: string, score: number, total: number) {
  saveProgress(lessonId, (p) =>
    p.bestScore === null || score > p.bestScore ? { ...p, bestScore: score, bestTotal: total } : p,
  );
}

export function useLessonProgress(lessonId: string): [LessonProgress, (fn: (p: LessonProgress) => LessonProgress) => void] {
  const raw = useSyncExternalStore(subscribe, () => readRaw(lessonId), () => "");
  const progress = useMemo(() => parse(raw), [raw]);
  const update = useCallback((fn: (p: LessonProgress) => LessonProgress) => saveProgress(lessonId, fn), [lessonId]);
  return [progress, update];
}

/** Progress for several lessons at once (unit cards). */
export function useLessonsProgress(lessonIds: string[]): LessonProgress[] {
  const joined = lessonIds.join(",");
  const raw = useSyncExternalStore(
    subscribe,
    () => joined.split(",").map(readRaw).join("\u0001"),
    () => "",
  );
  return useMemo(() => {
    const parts = raw ? raw.split("\u0001") : [];
    return joined.split(",").map((_, i) => parse(parts[i] ?? ""));
  }, [raw, joined]);
}
