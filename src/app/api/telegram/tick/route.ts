import { parseAddisLocal } from "@/lib/time/clock";
import { secretMatches } from "@/lib/telegram/secret";
import { runTick } from "@/lib/telegram/tick";

/**
 * Called every 5 minutes by Supabase pg_cron + pg_net (see the telegram_bot migration) with the x-cron-secret
 * header (CRON_SECRET). Sends class reminders, the 7:00 summary and new-lesson announcements.
 * Dev only: ?now=2026-11-16T07:00 fakes the Addis Ababa time.
 */
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-cron-secret"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  let now = Date.now();
  if (process.env.NODE_ENV === "development") {
    const fake = new URL(req.url).searchParams.get("now");
    const parsed = fake ? parseAddisLocal(fake) : null;
    if (parsed !== null) now = parsed;
  }
  try {
    return Response.json({ ok: true, ...(await runTick(now)) });
  } catch (e) {
    console.error("telegram tick failed:", e instanceof Error ? e.message : "unknown error");
    return Response.json({ ok: false }, { status: 500 });
  }
}
