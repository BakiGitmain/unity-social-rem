import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BOT_USERNAME } from "@/lib/telegram/bot";
import { botDb } from "@/lib/telegram/db";

/**
 * "Telegram bot" in the profile menu. Logged in → a one-time token (15 min) → t.me/UnitySocialRemBot?start=link_<token>,
 * which connects that Telegram chat to the account (homework progress in the bot). Logged out → the bot itself.
 */
export async function GET(req: Request) {
  const bot = `https://t.me/${BOT_USERNAME}`;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.redirect(bot, { headers: { "cache-control": "no-store" } });

  const token = randomBytes(24).toString("base64url"); // 32 characters
  const { error } = await botDb().from("telegram_link_tokens").insert({ token, user_id: userId });
  if (error) return NextResponse.redirect(new URL("/", req.url), { headers: { "cache-control": "no-store" } });
  return NextResponse.redirect(`${bot}?start=link_${token}`, { headers: { "cache-control": "no-store" } });
}
