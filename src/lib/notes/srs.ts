/**
 * Spaced repetition: a simple SM-2. Pure (tested in notes.test.ts).
 * Ratings: again (forgot) · hard · good · easy. Interval in days; ease starts at 2.5, never below 1.3.
 */
export type Rating = "again" | "hard" | "good" | "easy";
export type SrsState = { ease: number; interval: number; reps: number; lapses: number; due_at: string };

export const NEW_CARD = (now: Date = new Date()): SrsState => ({ ease: 2.5, interval: 0, reps: 0, lapses: 0, due_at: now.toISOString() });

const DAY = 86_400_000;
const Q: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export function review(s: SrsState, rating: Rating, now: Date = new Date()): SrsState {
  const q = Q[rating];
  // SM-2 ease update
  let ease = s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  ease = Math.max(1.3, Math.round(ease * 100) / 100);
  if (rating === "again") {
    // forgot: show again in 10 minutes, start the intervals over
    return { ease, interval: 0, reps: 0, lapses: s.lapses + 1, due_at: new Date(now.getTime() + 10 * 60_000).toISOString() };
  }
  let interval: number;
  if (s.reps === 0) interval = rating === "easy" ? 4 : 1;
  else if (s.reps === 1) interval = rating === "hard" ? 3 : rating === "easy" ? 8 : 6;
  else interval = Math.round(s.interval * (rating === "hard" ? 1.2 : rating === "easy" ? ease * 1.3 : ease));
  interval = Math.max(1, Math.min(interval, 3650));
  return { ease, interval, reps: s.reps + 1, lapses: s.lapses, due_at: new Date(now.getTime() + interval * DAY).toISOString() };
}

export const isDue = (s: Pick<SrsState, "due_at">, now: Date = new Date()) => new Date(s.due_at).getTime() <= now.getTime();

/** "in 6 days" style preview for the rating buttons. */
export function previewInterval(s: SrsState, rating: Rating, now: Date = new Date()): string {
  const next = review(s, rating, now);
  const ms = new Date(next.due_at).getTime() - now.getTime();
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  const d = Math.round(ms / DAY);
  return d < 30 ? `${d} d` : d < 365 ? `${Math.round(d / 30)} mo` : `${Math.round(d / 365)} y`;
}
