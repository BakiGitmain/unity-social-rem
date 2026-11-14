/**
 * Local testing of @UnitySocialRemBot WITHOUT a webhook: long-polls getUpdates and forwards every update to the
 * local dev server's webhook route (with the secret header), so the real bot code runs on your PC.
 *
 *   npm run dev                          (in another terminal)
 *   node scripts/telegram-poll.mjs       [--port 3000] [--tick] [--now 2026-11-16T07:45] [--force]
 *
 *   --tick    also calls /api/telegram/tick every minute (reminders + new lessons), like pg_cron in production
 *   --now     with --tick: fake Addis Ababa time for the tick (dev only)
 *   --force   remove a webhook that is set (production would stop receiving updates until setWebhook again!)
 *
 * Privacy: only update types and command names are logged (no names, chat ids or message text).
 * Admin: while TELEGRAM_ADMIN_CHAT_ID is not set, a /start whose Telegram username equals TELEGRAM_ADMIN_USERNAME
 * (in .env.local, re-read on every /start) saves that chat id as TELEGRAM_ADMIN_CHAT_ID. Everyone else is ignored
 * for admin and never logged.
 * Secrets are read from .env.local (fresh on every start) and never printed.
 */
import { appendFileSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const readEnv = () =>
  Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
  );
const env = readEnv();
/** "@Name" / "name" → "name" (Telegram usernames are case-insensitive). */
const normUser = (u) => String(u ?? "").trim().replace(/^@/, "").toLowerCase();

for (const k of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"]) {
  if (!env[k]) {
    console.error(`Missing ${k} in .env.local`);
    process.exit(1);
  }
}
const BASE = `http://localhost:${opt("port", "3000")}`;
let adminId = env.TELEGRAM_ADMIN_CHAT_ID || "";

async function tg(method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description ?? res.status}`); // never the URL (it holds the token)
  return data.result;
}

function describe(u) {
  if (u.message) {
    const cmd = /^\/[a-z_]+/i.exec(u.message.text ?? "")?.[0];
    return `message ${cmd ?? (u.message.text ? "(text → Rem)" : "(no text)")}`;
  }
  if (u.callback_query) return `button ${String(u.callback_query.data ?? "").split(":")[0]}`;
  if (u.poll_answer) return "poll answer";
  if (u.my_chat_member) return `chat member: ${u.my_chat_member.new_chat_member?.status}`;
  return "other";
}

function maybeSaveAdmin(u) {
  if (adminId) return;
  const m = u.message;
  if (!m || m.chat?.type !== "private" || !/^\/start\s*$/.test(m.text ?? "")) return;
  const want = normUser(readEnv().TELEGRAM_ADMIN_USERNAME); // re-read: it may be filled in after this script started
  if (!want) {
    console.log("· /start received, but TELEGRAM_ADMIN_USERNAME is empty in .env.local: no admin saved.");
    return;
  }
  if (normUser(m.from?.username) !== want) return; // not the admin: ignored, not logged
  adminId = String(m.chat.id);
  appendFileSync(".env.local", `\nTELEGRAM_ADMIN_CHAT_ID=${adminId}\n`);
  console.log(`\n★ /start from @${want}: chat id ${adminId} saved as TELEGRAM_ADMIN_CHAT_ID in .env.local.\n`);
}

const info = await tg("getWebhookInfo");
if (info.url) {
  if (!flag("force")) {
    console.error("A webhook is set (production is live). Polling would stop it. Re-run with --force if you really want that,");
    console.error("then restore it with: node scripts/telegram-setup.mts webhook https://<site>/api/telegram/webhook");
    process.exit(1);
  }
  await tg("deleteWebhook", { drop_pending_updates: false });
  console.log("Webhook removed (polling mode).");
}

const me = await tg("getMe");
console.log(`Polling @${me.username} → ${BASE}/api/telegram/webhook   (Ctrl+C to stop)`);
if (!adminId) {
  const want = normUser(env.TELEGRAM_ADMIN_USERNAME);
  console.log(
    want
      ? `TELEGRAM_ADMIN_CHAT_ID is not set: a /start from @${want} will be saved as the admin.`
      : "TELEGRAM_ADMIN_CHAT_ID is not set and TELEGRAM_ADMIN_USERNAME is empty: fill in the username in .env.local first.",
  );
}

if (flag("tick")) {
  if (!env.CRON_SECRET) {
    console.error("--tick needs CRON_SECRET in .env.local");
    process.exit(1);
  }
  const now = opt("now", "");
  const tick = async () => {
    try {
      const res = await fetch(`${BASE}/api/telegram/tick${now ? `?now=${encodeURIComponent(now)}` : ""}`, { method: "POST", headers: { "x-cron-secret": env.CRON_SECRET } });
      const body = await res.json().catch(() => ({}));
      const { summary = 0, reminders = 0, lessons = 0, recipients = 0 } = body;
      console.log(`tick ${res.status}: summary ${summary}, reminders ${reminders}, lessons ${lessons}, messages ${recipients}`);
    } catch {
      console.log("tick: dev server not reachable");
    }
  };
  await tick();
  setInterval(tick, 60_000);
}

let offset = 0;
for (;;) {
  let updates = [];
  try {
    updates = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query", "poll_answer", "my_chat_member"] });
  } catch (e) {
    console.log(`getUpdates failed: ${e.message}. Retrying in 3 s`);
    await new Promise((r) => setTimeout(r, 3000));
    continue;
  }
  for (const u of updates) {
    offset = u.update_id + 1;
    maybeSaveAdmin(u);
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/api/telegram/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": env.TELEGRAM_WEBHOOK_SECRET },
        body: JSON.stringify(u),
      });
      console.log(`${describe(u)} → ${res.status} (${Date.now() - t0} ms)`);
    } catch {
      console.log(`${describe(u)} → dev server not reachable (is npm run dev running on ${BASE}?)`);
    }
  }
}
