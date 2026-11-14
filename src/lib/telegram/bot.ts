import "server-only";
import { getSchedule } from "@/lib/data";
import { addisParts } from "@/lib/time/clock";
import { isoDate } from "@/lib/time/overrides";
import { TelegramError, answerCallback, editHtml, sendHtml, sendPng, takeSentCount, tg, typing, uploadingPhoto, type TgCallback, type TgChatMember, type TgMessage, type TgPollAnswer, type TgUpdate } from "@/lib/telegram/api";
import { broadcast } from "@/lib/telegram/broadcast";
import {
  audience,
  botDb,
  flushSent,
  getSubscriber,
  homeworkDone,
  loadLessons,
  loadQuizRow,
  loadQuizRows,
  markInactive,
  profileUsername,
  touchSubscriber,
  updateSubscriber,
  type BotDb,
  type BotState,
  type Subscriber,
} from "@/lib/telegram/db";
import { bar, card, esc, isAmharicText } from "@/lib/telegram/format";
import { vennCaption, type VennSpec } from "@/lib/telegram/venn";
import { renderVennPng } from "@/lib/telegram/venn-image";
import { tr, type Lang } from "@/lib/telegram/i18n";
import { findLesson, pickQuiz, toPoll, type BotLesson } from "@/lib/telegram/lessons";
import { TG_REM_DAILY, askRem } from "@/lib/telegram/rem";
import {
  SUBJECT_ORDER,
  announcementView,
  helpView,
  homeworkView,
  lessonsView,
  menuView,
  newLessonView,
  nextView,
  quizPickView,
  quizScoreView,
  remAnswerView,
  remAskingLine,
  remIntroView,
  settingsView,
  statsView,
  todayView,
  welcomeView,
  type View,
} from "@/lib/telegram/views";

export const BOT_USERNAME = "UnitySocialRemBot";
/** Buttons always open the live site (Telegram does not accept localhost links). */
export const SITE_URL = (process.env.SITE_URL || "https://unity-social-rem.vercel.app").replace(/\/+$/, "");

const QUIZ_LENGTH = 5;

type Ctx = { db: BotDb; sub: Subscriber; chatId: number; lang: Lang; isAdmin: boolean; name: string };

export function isAdminChat(chatId: number): boolean {
  const admin = process.env.TELEGRAM_ADMIN_CHAT_ID;
  return !!admin && admin.trim() === String(chatId);
}

/** Entry point for one update (webhook or the local polling script). Never throws for a bad update. */
export async function handleUpdate(update: TgUpdate): Promise<void> {
  const db = botDb();
  try {
    if (update.message) await onMessage(db, update.message);
    else if (update.callback_query) await onCallback(db, update.callback_query);
    else if (update.poll_answer) await onPollAnswer(db, update.poll_answer);
    else if (update.my_chat_member) await onChatMember(db, update.my_chat_member);
  } finally {
    await flushSent(db, takeSentCount()).catch(() => {});
  }
}

async function context(db: BotDb, m: { chat: { id: number }; from?: { username?: string; first_name?: string; language_code?: string } }): Promise<Ctx> {
  const sub = await touchSubscriber(db, { chatId: m.chat.id, username: m.from?.username, firstName: m.from?.first_name, languageCode: m.from?.language_code });
  return { db, sub, chatId: m.chat.id, lang: sub.language, isAdmin: isAdminChat(m.chat.id), name: sub.first_name ?? "" };
}

const send = (ctx: Ctx, v: View) => sendHtml(ctx.chatId, v.html, v.keyboard.length ? v.keyboard : undefined);
/** Shows a screen: edits the message the button was on, or sends a new one for typed commands. */
const show = (ctx: Ctx, v: View, editId?: number) => (editId ? editHtml(ctx.chatId, editId, v.html, v.keyboard) : send(ctx, v));

async function saveState(ctx: Ctx, patch: Partial<BotState>) {
  const state: BotState = { ...ctx.sub.state, ...patch };
  for (const k of Object.keys(patch) as (keyof BotState)[]) if (patch[k] === undefined) delete state[k];
  ctx.sub.state = state;
  await updateSubscriber(ctx.db, ctx.chatId, { state });
}

/* ------------------------------------------------------------------ messages */

const COMMAND = /^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i;

async function onMessage(db: BotDb, msg: TgMessage) {
  if (msg.from?.is_bot) return;
  if (msg.chat.type !== "private") return; // the bot only talks in private chats
  const ctx = await context(db, msg);
  const text = (msg.text ?? "").trim();
  if (!text) return void (await send(ctx, { html: tr(ctx.lang, "unknown"), keyboard: [] }));

  const m = COMMAND.exec(text);
  if (!m) return remAsk(ctx, text);
  const cmd = m[1]!.toLowerCase();
  const arg = (m[2] ?? "").trim();

  switch (cmd) {
    case "start":
      if (arg.startsWith("link_")) return linkAccount(ctx, arg.slice(5));
      return void (await send(ctx, welcomeView(ctx.name, ctx.lang)));
    case "menu":
      return void (await send(ctx, menuView(ctx.lang, SITE_URL)));
    case "today":
      return showToday(ctx);
    case "next":
      return showNext(ctx);
    case "lessons":
      return showLessons(ctx);
    case "homework":
      return showHomework(ctx);
    case "quiz":
      return showQuizPick(ctx);
    case "rem":
      return arg ? remAsk(ctx, arg) : showRemIntro(ctx);
    case "settings":
      return showSettings(ctx);
    case "help":
      return void (await send(ctx, helpView(ctx.lang, TG_REM_DAILY, ctx.isAdmin)));
  }
  if (ctx.isAdmin) {
    if (cmd === "announce") return adminAnnounce(ctx, arg);
    if (cmd === "stats") return adminStats(ctx);
    if (cmd === "notify") return adminNotify(ctx, arg);
  }
  await send(ctx, { html: tr(ctx.lang, "unknown"), keyboard: [[{ text: tr(ctx.lang, "btnMenu"), callback_data: "m" }]] });
}

/* ------------------------------------------------------------------ buttons */

async function onCallback(db: BotDb, cb: TgCallback) {
  const msg = cb.message;
  if (!msg || msg.chat.type !== "private") return answerCallback(cb.id);
  const ctx = await context(db, { chat: msg.chat, from: cb.from });
  const data = cb.data ?? "";
  const [key, val] = data.split(":") as [string, string | undefined];
  const edit = msg.message_id;
  let toast: string | undefined;

  try {
    switch (key) {
      case "l": // language from the welcome card → main menu
        await setLanguage(ctx, val === "am" ? "am" : "en");
        toast = tr(ctx.lang, "langSaved");
        await show(ctx, menuView(ctx.lang, SITE_URL, ctx.name), edit);
        break;
      case "m":
        await show(ctx, menuView(ctx.lang, SITE_URL), edit);
        break;
      case "t":
        await showToday(ctx, edit);
        break;
      case "n":
        await showNext(ctx, edit);
        break;
      case "ls":
        await showLessons(ctx, edit, val);
        break;
      case "hw":
        await showHomework(ctx, edit, val);
        break;
      case "qz":
        if (val) await startQuiz(ctx, val, edit);
        else await showQuizPick(ctx, edit);
        break;
      case "rm":
        await showRemIntro(ctx, edit);
        break;
      case "st":
        await showSettings(ctx, edit);
        break;
      case "sl":
        await setLanguage(ctx, val === "am" ? "am" : "en");
        toast = tr(ctx.lang, "langSaved");
        await showSettings(ctx, edit);
        break;
      case "rem":
        await updateSubscriber(db, ctx.chatId, { reminders_on: val === "1" });
        ctx.sub.reminders_on = val === "1";
        toast = tr(ctx.lang, val === "1" ? "remindersOnToast" : "remindersOffToast");
        await showSettings(ctx, edit);
        break;
      case "ul":
        await updateSubscriber(db, ctx.chatId, { profile_id: null });
        ctx.sub.profile_id = null;
        toast = tr(ctx.lang, "unlinked");
        await showSettings(ctx, edit);
        break;
      case "h":
        await show(ctx, helpView(ctx.lang, TG_REM_DAILY, ctx.isAdmin), edit);
        break;
      case "fu": {
        const q = ctx.sub.state.followups?.[Number(val)];
        if (!q) {
          toast = tr(ctx.lang, "remFollowupGone");
          break;
        }
        await answerCallback(cb.id);
        await remAsk(ctx, q, true);
        return;
      }
      case "an":
        if (ctx.isAdmin) await adminAnnounceConfirm(ctx, val === "ok", edit);
        break;
      case "ss":
        if (ctx.isAdmin) await adminStats(ctx, edit);
        break;
    }
  } finally {
    await answerCallback(cb.id, toast);
  }
}

async function setLanguage(ctx: Ctx, lang: Lang) {
  await updateSubscriber(ctx.db, ctx.chatId, { language: lang });
  ctx.sub.language = lang;
  ctx.lang = lang;
}

/* ------------------------------------------------------------------ screens */

async function schedule() {
  const s = await getSchedule();
  return s ? { entries: s.entries, overrides: s.overrides } : null;
}

async function showToday(ctx: Ctx, edit?: number) {
  await show(ctx, todayView(await schedule(), Date.now(), ctx.lang, SITE_URL), edit);
}

async function showNext(ctx: Ctx, edit?: number) {
  await show(ctx, nextView(await schedule(), Date.now(), ctx.lang, SITE_URL), edit);
}

async function showLessons(ctx: Ctx, edit?: number, subject?: string) {
  const s = subject && (SUBJECT_ORDER as readonly string[]).includes(subject) ? subject : undefined;
  await show(ctx, lessonsView(await loadLessons(), ctx.lang, SITE_URL, s), edit);
}

async function showHomework(ctx: Ctx, edit?: number, subject?: string) {
  const s = subject && (SUBJECT_ORDER as readonly string[]).includes(subject) ? subject : undefined;
  const [lessons, done] = await Promise.all([loadLessons({ homework: true }), ctx.sub.profile_id ? homeworkDone(ctx.db, ctx.sub.profile_id) : Promise.resolve(null)]);
  await show(ctx, homeworkView(lessons, ctx.lang, SITE_URL, s, done), edit);
}

async function showSettings(ctx: Ctx, edit?: number) {
  const username = await profileUsername(ctx.db, ctx.sub.profile_id);
  await show(ctx, settingsView(ctx.lang, ctx.sub.reminders_on, username), edit);
}

async function remUsedToday(ctx: Ctx): Promise<number> {
  const { data } = await ctx.db.from("telegram_usage").select("rem").eq("chat_id", ctx.chatId).eq("day", isoDate(addisParts(Date.now()))).maybeSingle();
  return (data as { rem: number } | null)?.rem ?? 0;
}

async function showRemIntro(ctx: Ctx, edit?: number) {
  const used = await remUsedToday(ctx);
  await show(ctx, remIntroView(ctx.lang, Math.max(0, TG_REM_DAILY - used), TG_REM_DAILY), edit);
}

/* ------------------------------------------------------------------ Rem */

async function remAsk(ctx: Ctx, question: string, fromButton = false) {
  await typing(ctx.chatId);
  const menu = [[{ text: tr(ctx.lang, "btnMenu"), callback_data: "m" }]];
  const asked = fromButton ? `<i>❓ ${esc(question)}</i>\n` : "";
  // As soon as the question is counted: "Asking Rem… (x/15 today)". That message is edited into the answer.
  let placeholder: number | undefined;
  const res = await askRem(ctx.db, ctx.chatId, question, ctx.sub.state.history, async (used) => {
    const m = await sendHtml(ctx.chatId, `${asked}${remAskingLine(used, TG_REM_DAILY, ctx.lang)}`);
    placeholder = m.message_id;
    await typing(ctx.chatId);
  });
  if (res.kind !== "answer") {
    const key = res.kind === "limit" ? "remLimit" : res.kind === "resting" ? "remResting" : res.kind === "flagged" ? "remFlagged" : res.kind === "too_long" ? "remTooLong" : "remError";
    await show(ctx, { html: tr(ctx.lang, key, { limit: TG_REM_DAILY }), keyboard: menu }, placeholder);
    return;
  }
  await saveState(ctx, { followups: res.followups, history: res.history });
  const view = remAnswerView(res.html, res.followups, res.used, TG_REM_DAILY, ctx.lang);
  if (asked) view.html = asked + view.html;
  await show(ctx, view, placeholder);
  if (res.venn) await sendVenn(ctx, res.venn, isAmharicText(res.html) ? "am" : "en", placeholder);
}

/** Rem's Venn diagram as a real picture (numbered regions + a caption). Text answer already sent, so failures are quiet. */
async function sendVenn(ctx: Ctx, spec: VennSpec, lang: Lang, replyTo?: number) {
  try {
    await uploadingPhoto(ctx.chatId);
    const png = await renderVennPng(spec);
    await sendPng(ctx.chatId, png, vennCaption(spec, lang), "venn.png", replyTo);
  } catch (e) {
    console.error("telegram venn:", e instanceof Error ? e.message : "failed");
  }
}

/* ------------------------------------------------------------------ quiz (Telegram quiz polls) */

async function showQuizPick(ctx: Ctx, edit?: number) {
  const lessons = await loadLessons();
  const subjects = SUBJECT_ORDER.filter((s) => lessons.some((l) => l.subject.slug === s && l.quizCount > 0));
  await show(ctx, quizPickView(subjects, ctx.lang), edit);
}

async function sendPoll(ctx: Ctx, poll: NonNullable<ReturnType<typeof toPoll>>) {
  return tg<{ poll?: { id: string } }>("sendPoll", {
    chat_id: ctx.chatId,
    question: poll.question,
    options: poll.options.map((text) => ({ text })),
    type: "quiz",
    is_anonymous: false,
    correct_option_id: poll.correct,
    ...(poll.explanation ? { explanation: poll.explanation } : {}),
  });
}

async function startQuiz(ctx: Ctx, subject: string, edit?: number) {
  const lessons = await loadLessons();
  const pool = subject === "all" ? lessons : lessons.filter((l) => l.subject.slug === subject);
  const picked = pickQuiz(await loadQuizRows(pool.map((l) => l.id)), QUIZ_LENGTH);
  const first = picked[0] && toPoll(picked[0], ctx.lang, { i: 1, total: picked.length });
  if (!first) return show(ctx, { html: tr(ctx.lang, "quizNone"), keyboard: [[{ text: tr(ctx.lang, "btnMenu"), callback_data: "m" }]] }, edit);
  await show(ctx, { html: card({ icon: "🎯", title: tr(ctx.lang, "quizTitle"), sections: [tr(ctx.lang, "quizStart"), `${bar(0)}  0/${picked.length}`] }), keyboard: [] }, edit);
  const msg = await sendPoll(ctx, first);
  await saveState(ctx, { quiz: { ids: picked.map((q) => q.id), i: 0, score: 0, pollId: msg.poll?.id ?? "", correct: first.correct, subject } });
}

async function onPollAnswer(db: BotDb, pa: TgPollAnswer) {
  const chatId = pa.user?.id;
  if (!chatId) return;
  const sub = await getSubscriber(db, chatId);
  const quiz = sub?.state.quiz;
  if (!sub || !quiz || quiz.pollId !== pa.poll_id || !pa.option_ids.length) return;
  const ctx: Ctx = { db, sub, chatId, lang: sub.language, isAdmin: isAdminChat(chatId), name: sub.first_name ?? "" };
  const score = quiz.score + (pa.option_ids[0] === quiz.correct ? 1 : 0);
  const i = quiz.i + 1;
  if (i >= quiz.ids.length) {
    await saveState(ctx, { quiz: undefined });
    await send(ctx, quizScoreView(score, quiz.ids.length, ctx.lang, quiz.subject));
    return;
  }
  // A short pause so the explanation can be read before the next question arrives.
  await new Promise((r) => setTimeout(r, 1200));
  const row = await loadQuizRow(quiz.ids[i]!);
  const poll = row && toPoll(row, ctx.lang, { i: i + 1, total: quiz.ids.length });
  if (!poll) {
    await saveState(ctx, { quiz: undefined });
    await send(ctx, quizScoreView(score, i, ctx.lang, quiz.subject));
    return;
  }
  const msg = await sendPoll(ctx, poll);
  await saveState(ctx, { quiz: { ...quiz, i, score, pollId: msg.poll?.id ?? "", correct: poll.correct } });
}

/* ------------------------------------------------------------------ blocked / unblocked */

async function onChatMember(db: BotDb, m: TgChatMember) {
  if (m.chat.type !== "private") return;
  const status = m.new_chat_member.status;
  if (status === "kicked" || status === "left") await markInactive(db, [m.chat.id]);
  else if (status === "member") await db.from("telegram_subscribers").update({ active: true }).eq("chat_id", m.chat.id);
}

/* ------------------------------------------------------------------ link a site account */

async function linkAccount(ctx: Ctx, token: string) {
  const bad = () => send(ctx, { html: tr(ctx.lang, "linkBad"), keyboard: [[{ text: tr(ctx.lang, "btnMenu"), callback_data: "m" }]] });
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return void (await bad());
  const { data } = await ctx.db.from("telegram_link_tokens").delete().eq("token", token).gt("expires_at", new Date().toISOString()).select("user_id");
  const userId = (data as { user_id: string }[] | null)?.[0]?.user_id;
  if (!userId) return void (await bad());
  await ctx.db.from("telegram_subscribers").update({ profile_id: null }).eq("profile_id", userId).neq("chat_id", ctx.chatId);
  await updateSubscriber(ctx.db, ctx.chatId, { profile_id: userId });
  ctx.sub.profile_id = userId;
  const username = (await profileUsername(ctx.db, userId)) ?? "";
  await send(ctx, {
    html: card({ icon: "🔗", title: tr(ctx.lang, "linkedTitle"), sections: [tr(ctx.lang, "linkedBody", { username: esc(username) })] }),
    keyboard: [[{ text: tr(ctx.lang, "btnHomework"), callback_data: "hw" }, { text: tr(ctx.lang, "btnMenu"), callback_data: "m" }]],
  });
}

/* ------------------------------------------------------------------ admin */

async function adminAnnounce(ctx: Ctx, text: string) {
  if (!text) return void (await send(ctx, { html: tr(ctx.lang, "admAnnounceUsage"), keyboard: [] }));
  const n = (await audience(ctx.db)).length;
  await saveState(ctx, { announce: text.slice(0, 3500) });
  await send(ctx, announcementView(text.slice(0, 3500), ctx.lang));
  await send(ctx, {
    html: `👆 ${tr(ctx.lang, "admPreview", { n })}`,
    keyboard: [[{ text: tr(ctx.lang, "admConfirm"), callback_data: "an:ok" }, { text: tr(ctx.lang, "admCancel"), callback_data: "an:no" }]],
  });
}

async function adminAnnounceConfirm(ctx: Ctx, ok: boolean, edit: number) {
  const text = ctx.sub.state.announce;
  if (!text) return editHtml(ctx.chatId, edit, tr(ctx.lang, "admNothing"));
  await saveState(ctx, { announce: undefined });
  if (!ok) return editHtml(ctx.chatId, edit, tr(ctx.lang, "admCancelled"));
  await editHtml(ctx.chatId, edit, tr(ctx.lang, "admSending"));
  const r = await broadcast(ctx.db, await audience(ctx.db), (lang) => announcementView(text, lang));
  await editHtml(ctx.chatId, edit, `✅ ${tr(ctx.lang, "admSent", { sent: r.sent, total: r.total, failed: r.failed })}`);
}

async function adminStats(ctx: Ctx, edit?: number) {
  const { data } = await ctx.db.rpc("telegram_stats");
  await show(ctx, statsView((data ?? {}) as Record<string, number>), edit);
}

async function adminNotify(ctx: Ctx, query: string) {
  if (!query) return void (await send(ctx, { html: tr(ctx.lang, "admNotifyUsage"), keyboard: [] }));
  const lessons = await loadLessons({ homework: true });
  const found = findLesson(lessons, query);
  if (!found) return void (await send(ctx, { html: tr(ctx.lang, "admNotFound", { q: esc(query) }), keyboard: [] }));
  if (Array.isArray(found)) {
    return void (await send(ctx, { html: `${tr(ctx.lang, "admAmbiguous")}\n${found.map((l) => `<code>${esc(l.key)}</code>`).join("\n")}`, keyboard: [] }));
  }
  const r = await announceLesson(ctx.db, found);
  await send(ctx, { html: `✅ <code>${esc(found.key)}</code>\n${tr(ctx.lang, "admSent", { sent: r.sent, total: r.total, failed: r.failed })}`, keyboard: [] });
}

/** Sends the "new lesson" card to every active subscriber and records it in telegram_sent_lessons. */
export async function announceLesson(db: BotDb, lesson: BotLesson) {
  const r = await broadcast(db, await audience(db), (lang) => newLessonView(lesson, lang, SITE_URL));
  await db.from("telegram_sent_lessons").upsert({ lesson_id: lesson.id, lesson_key: lesson.key, recipients: r.sent, sent_at: new Date().toISOString() }, { onConflict: "lesson_id" });
  return r;
}

export { TelegramError };
