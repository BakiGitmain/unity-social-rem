import "server-only";

/**
 * Minimal Telegram Bot API client. The token is read from TELEGRAM_BOT_TOKEN and NEVER logged, returned or put
 * in an error message (Telegram URLs contain it, so errors only carry the method name + Telegram's description).
 */

export class TelegramError extends Error {
  constructor(
    public method: string,
    public code: number,
    public description: string,
    public retryAfter?: number,
  ) {
    super(`Telegram ${method} failed (${code}): ${description}`);
  }
  /** The user blocked the bot / deleted their account / the chat is gone: stop sending to them. */
  get gone(): boolean {
    return this.code === 403 || (this.code === 400 && /chat not found|user is deactivated|PEER_ID_INVALID/i.test(this.description));
  }
}

/** Messages the bot sent during this request (flushed into telegram_daily once at the end). */
let sentCounter = 0;
export function takeSentCount(): number {
  const n = sentCounter;
  sentCounter = 0;
  return n;
}

const SENDS = new Set(["sendMessage", "sendPoll", "sendPhoto", "copyMessage"]);

/** `body` is JSON, or FormData for uploads (sendPhoto with a file). */
export async function tg<T = unknown>(method: string, body: Record<string, unknown> | FormData = {}): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramError(method, 500, "bot is not configured");
  const form = body instanceof FormData;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        ...(form ? {} : { headers: { "content-type": "application/json" } }),
        body: form ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(form ? 30_000 : 15_000),
      });
    } catch {
      if (attempt < 1) continue;
      throw new TelegramError(method, 0, "network error");
    }
    const data = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; error_code?: number; description?: string; parameters?: { retry_after?: number } } | null;
    if (data?.ok) {
      if (SENDS.has(method)) sentCounter++;
      return data.result as T;
    }
    const code = data?.error_code ?? res.status;
    const retryAfter = data?.parameters?.retry_after;
    // Flood control: wait as asked (short waits only, we run inside a serverless function).
    if (code === 429 && retryAfter !== undefined && retryAfter <= 10 && attempt < 2) {
      await new Promise((r) => setTimeout(r, (retryAfter + 0.2) * 1000));
      continue;
    }
    throw new TelegramError(method, code, (data?.description ?? res.statusText).slice(0, 200), retryAfter);
  }
}

/* ------------------------------------------------------------------ types (only what the bot uses) */

export type TgUser = { id: number; is_bot?: boolean; first_name?: string; username?: string; language_code?: string };
export type TgChat = { id: number; type: "private" | "group" | "supergroup" | "channel" };
export type TgMessage = { message_id: number; chat: TgChat; from?: TgUser; text?: string; date: number };
export type TgCallback = { id: string; from: TgUser; message?: TgMessage; data?: string };
export type TgPollAnswer = { poll_id: string; user?: TgUser; option_ids: number[] };
export type TgChatMember = { chat: TgChat; from: TgUser; new_chat_member: { status: string } };
export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallback;
  poll_answer?: TgPollAnswer;
  my_chat_member?: TgChatMember;
};

export type Button = { text: string; callback_data?: string; url?: string };
export type Keyboard = Button[][];
export const kb = (rows: Keyboard) => ({ inline_keyboard: rows });

/* ------------------------------------------------------------------ helpers */

export function sendHtml(chatId: number, html: string, keyboard?: Keyboard) {
  return tg<TgMessage>("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: kb(keyboard) } : {}),
  });
}

/** Uploads a PNG (made on the server) with an HTML caption (≤ 1024 characters). */
export function sendPng(chatId: number, png: Uint8Array, captionHtml: string, filename = "image.png", replyTo?: number) {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("photo", new Blob([png as Uint8Array<ArrayBuffer>], { type: "image/png" }), filename);
  form.set("caption", captionHtml);
  form.set("parse_mode", "HTML");
  if (replyTo) form.set("reply_parameters", JSON.stringify({ message_id: replyTo, allow_sending_without_reply: true }));
  return tg<TgMessage>("sendPhoto", form);
}

export async function uploadingPhoto(chatId: number) {
  try {
    await tg("sendChatAction", { chat_id: chatId, action: "upload_photo" });
  } catch {
    /* not important */
  }
}

/** Edits a message in place (button presses). "message is not modified" is not an error. */
export async function editHtml(chatId: number, messageId: number, html: string, keyboard?: Keyboard) {
  try {
    await tg("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: html,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(keyboard ? { reply_markup: kb(keyboard) } : {}),
    });
  } catch (e) {
    if (e instanceof TelegramError && /message is not modified/i.test(e.description)) return;
    throw e;
  }
}

export async function answerCallback(id: string, text?: string) {
  try {
    await tg("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });
  } catch {
    /* too old to answer: fine */
  }
}

export async function typing(chatId: number) {
  try {
    await tg("sendChatAction", { chat_id: chatId, action: "typing" });
  } catch {
    /* not important */
  }
}
