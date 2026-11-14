import "server-only";
import { TelegramError, sendHtml } from "@/lib/telegram/api";
import { markInactive, type BotDb } from "@/lib/telegram/db";
import type { Lang } from "@/lib/telegram/i18n";
import type { View } from "@/lib/telegram/views";

/** Telegram allows ~30 messages / second for broadcasts; we stay at 25. */
export const BROADCAST_PER_SECOND = 25;

/**
 * Sends one view (built once per language) to many chats, paced at 25 / second. Users who blocked the bot (403)
 * are marked inactive and get nothing more. Returns how many were sent.
 */
export async function broadcast(db: BotDb, recipients: { chat_id: number; language: Lang }[], build: (lang: Lang) => View) {
  const views: Partial<Record<Lang, View>> = {};
  const viewFor = (lang: Lang) => (views[lang] ??= build(lang));
  const gap = 1000 / BROADCAST_PER_SECOND;
  const gone: number[] = [];
  let sent = 0;
  let failed = 0;
  let next = Date.now();
  for (const r of recipients) {
    const wait = next - Date.now();
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    next = Math.max(Date.now(), next) + gap;
    const v = viewFor(r.language === "am" ? "am" : "en");
    try {
      await sendHtml(r.chat_id, v.html, v.keyboard.length ? v.keyboard : undefined);
      sent++;
    } catch (e) {
      failed++;
      if (e instanceof TelegramError && e.gone) gone.push(r.chat_id);
      else if (e instanceof TelegramError && e.code === 429) next = Date.now() + ((e.retryAfter ?? 1) + 0.5) * 1000;
    }
  }
  await markInactive(db, gone);
  return { sent, failed, total: recipients.length, blocked: gone.length };
}
