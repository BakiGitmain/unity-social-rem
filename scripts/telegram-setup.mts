/**
 * @UnitySocialRemBot setup (run with plain Node, it strips the types):
 *
 *   node scripts/telegram-setup.mts profile          commands (EN + AM, admin extras), description, short description
 *   node scripts/telegram-setup.mts webhook <url>    setWebhook with the secret token, then getWebhookInfo
 *   node scripts/telegram-setup.mts info             getWebhookInfo
 *   node scripts/telegram-setup.mts delete-webhook   back to polling (local testing)
 *   node scripts/telegram-setup.mts tick <url>       saves the tick URL + CRON_SECRET in Supabase Vault (pg_cron uses it)
 *
 * Secrets come from .env.local (or the environment) and are NEVER printed.
 */
import { readFileSync } from "node:fs";
import { ADMIN_COMMANDS, COMMANDS, DESCRIPTION } from "../src/lib/telegram/i18n.ts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const i = line.indexOf("=");
      if (i > 0 && !line.startsWith("#")) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
    }
  } catch {
    /* no .env.local: use the environment */
  }
  return { ...env, ...(process.env as Record<string, string>) };
}
const env = loadEnv();
const need = (k: string) => {
  const v = env[k];
  if (!v) {
    console.error(`Missing ${k} (in .env.local or the environment).`);
    process.exit(1);
  }
  return v;
};

async function tg(method: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${need("TELEGRAM_BOT_TOKEN")}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!data.ok) throw new Error(`${method}: ${data.description ?? res.status}`); // no URL (it holds the token)
  return data.result;
}

const ALLOWED_UPDATES = ["message", "callback_query", "poll_answer", "my_chat_member"];

async function profile() {
  await tg("setMyCommands", { commands: COMMANDS.en });
  await tg("setMyCommands", { commands: COMMANDS.en, language_code: "en" });
  await tg("setMyCommands", { commands: COMMANDS.am, language_code: "am" });
  const admin = env.TELEGRAM_ADMIN_CHAT_ID;
  if (admin) {
    await tg("setMyCommands", { commands: [...COMMANDS.en, ...ADMIN_COMMANDS], scope: { type: "chat", chat_id: Number(admin) } });
    console.log("✓ admin commands (only in the admin chat)");
  } else console.log("· TELEGRAM_ADMIN_CHAT_ID not set yet: admin commands skipped");
  for (const [lang, code] of [["en", undefined], ["en", "en"], ["am", "am"]] as const) {
    const d = DESCRIPTION[lang];
    await tg("setMyDescription", { description: d.description, ...(code ? { language_code: code } : {}) });
    await tg("setMyShortDescription", { short_description: d.short, ...(code ? { language_code: code } : {}) });
  }
  console.log("✓ commands (EN + AM), description and short description set");
}

async function info() {
  const i = (await tg("getWebhookInfo")) as { url?: string; pending_update_count?: number; last_error_message?: string; last_error_date?: number; allowed_updates?: string[]; max_connections?: number };
  console.log(
    JSON.stringify(
      {
        url: i.url || "(none: polling mode)",
        pending_update_count: i.pending_update_count,
        allowed_updates: i.allowed_updates,
        max_connections: i.max_connections,
        last_error: i.last_error_message ? `${i.last_error_message} (${new Date((i.last_error_date ?? 0) * 1000).toISOString()})` : null,
      },
      null,
      2,
    ),
  );
}

async function webhook(url: string) {
  if (!/^https:\/\/[^/]+\/api\/telegram\/webhook$/.test(url)) throw new Error("URL must be https://<host>/api/telegram/webhook");
  await tg("setWebhook", { url, secret_token: need("TELEGRAM_WEBHOOK_SECRET"), allowed_updates: ALLOWED_UPDATES, max_connections: 20 });
  console.log("✓ setWebhook");
  await info();
}

async function tick(url: string) {
  if (!/^https:\/\/[^/]+\/api\/telegram\/tick$/.test(url)) throw new Error("URL must be https://<host>/api/telegram/tick");
  const res = await fetch(`${need("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/rpc/telegram_configure_tick`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: need("SUPABASE_SECRET_KEY"), authorization: `Bearer ${need("SUPABASE_SECRET_KEY")}` },
    body: JSON.stringify({ p_url: url, p_secret: need("CRON_SECRET") }),
  });
  if (!res.ok) throw new Error(`telegram_configure_tick: ${res.status} ${(await res.text()).slice(0, 200)}`);
  console.log("✓ tick URL + CRON_SECRET saved in Supabase Vault; pg_cron calls it every 5 minutes");
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === "profile") await profile();
  else if (cmd === "webhook" && arg) await webhook(arg);
  else if (cmd === "info") await info();
  else if (cmd === "delete-webhook") {
    await tg("deleteWebhook", { drop_pending_updates: false });
    console.log("✓ webhook removed");
  } else if (cmd === "tick" && arg) await tick(arg);
  else {
    console.log("Usage: node scripts/telegram-setup.mts profile | webhook <url> | info | delete-webhook | tick <url>");
    process.exit(1);
  }
} catch (e) {
  console.error("✖", e instanceof Error ? e.message : e);
  process.exit(1);
}
