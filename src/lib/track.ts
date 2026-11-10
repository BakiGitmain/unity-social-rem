/** Browser helper for first-party activity tracking (see /api/track). Fire-and-forget, never throws. */
type TrackBody =
  | { type: "lesson_view" | "lesson_complete" | "quiz_start"; lessonId: string }
  | { type: "quiz_attempt"; lessonId: string; answers: { question_id: string; chosen: number | null }[]; durationMs: number }
  | { type: "seen" };

export function track(body: TrackBody) {
  try {
    void fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* tracking must never break the page */
  }
}

const SEEN_KEY = "usr-seen-at";
/** "Last seen": at most one ping every 5 minutes per tab. */
export function pingSeen() {
  try {
    const last = Number(window.sessionStorage.getItem(SEEN_KEY) ?? 0);
    if (Date.now() - last < 5 * 60 * 1000) return;
    window.sessionStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {}
  track({ type: "seen" });
}
