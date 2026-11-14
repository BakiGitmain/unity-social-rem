import { handleUpdate } from "@/lib/telegram/bot";
import { secretMatches } from "@/lib/telegram/secret";
import type { TgUpdate } from "@/lib/telegram/api";

/**
 * Telegram webhook for @UnitySocialRemBot. Only requests with the right X-Telegram-Bot-Api-Secret-Token
 * (TELEGRAM_WEBHOOK_SECRET, given to Telegram in setWebhook) are processed; everything else gets 401.
 * Always answers 200 for a real update, even if handling it failed, so Telegram doesn't retry it forever.
 */
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response(null, { status: 401 });
  }
  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new Response(null, { status: 400 });
  }
  try {
    await handleUpdate(update);
  } catch (e) {
    // Only the error message (never the update: it contains user data; never a token: errors don't carry it).
    console.error("telegram update failed:", e instanceof Error ? e.message : "unknown error");
  }
  return Response.json({ ok: true });
}
