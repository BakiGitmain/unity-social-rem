/**
 * Every bot screen as { html, keyboard }: pure functions of the data (no network), tested in views.test.ts.
 * Cards: bold header with an icon, a divider, short sections, ▰▰▱▱ bars. Buttons edit the message in place.
 */
import { addisParts, formatTime } from "../time/clock.ts";
import { formatEthiopianDateAm, gregorianToEthiopian } from "../time/ethiopian.ts";
import { addDays, isoDate, planForDate, scheduleStatusOn, type DayClass, type ScheduleOverride } from "../time/overrides.ts";
import type { ClassEntry } from "../time/schedule.ts";
import { TG_LIMITS, barPct, bar, card, clipHtml, duration, esc, inlineHtml } from "./format.ts";
import { WEEKDAYS, monthEn, tr, type Lang } from "./i18n.ts";
import { lessonPath, type BotLesson } from "./lessons.ts";

export type Button = { text: string; callback_data?: string; url?: string };
export type View = { html: string; keyboard: Button[][] };
export type Schedule = { entries: ClassEntry[]; overrides: ScheduleOverride[] } | null;

export const SUBJECT_ORDER = ["mathematics", "english", "geography", "history"] as const;
export const SUBJECT_ICON: Record<string, string> = { mathematics: "🔢", english: "🔤", geography: "🌍", history: "🏛" };
export const SUBJECT_NAME: Record<string, { en: string; am: string }> = {
  mathematics: { en: "Mathematics", am: "ሒሳብ" },
  english: { en: "English", am: "እንግሊዝኛ" },
  geography: { en: "Geography", am: "ጂኦግራፊ" },
  history: { en: "History", am: "ታሪክ" },
};
const subjName = (slug: string, lang: Lang) => SUBJECT_NAME[slug]?.[lang] ?? slug;

const btn = (text: string, data: string): Button => ({ text, callback_data: data });
const link = (text: string, url: string): Button => ({ text, url });
const pick = (b: { en: string; am: string }, lang: Lang) => (lang === "am" && b.am ? b.am : b.en);

/* ------------------------------------------------------------------ time + dates */

/** en "2:30 PM" · am "8:30 ከሰዓት (14:30)": Ethiopian clock first, international 24h in brackets. */
export function clock(minuteOfDay: number, lang: Lang): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = Math.round(minuteOfDay % 60);
  return lang === "am" ? `${formatTime(h, m, "eth")} (${formatTime(h, m, "24h")})` : formatTime(h, m, "12h");
}

/** en "Monday · Nov 16" · am "ሰኞ · ኅዳር 7, 2019 ዓ.ም" (Ethiopian calendar). */
export function dayLabel(date: string, weekday: number, lang: Lang): string {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const wd = WEEKDAYS[lang][weekday - 1];
  return lang === "am" ? `${wd} · ${formatEthiopianDateAm(gregorianToEthiopian(y, mo, d))}` : `${wd} · ${monthEn(mo)} ${d}`;
}

const roomLine = (c: Pick<DayClass, "roomEn" | "roomAm" | "floor">, lang: Lang) => {
  const room = lang === "am" ? c.roomAm || c.roomEn : c.roomEn;
  if (!room) return "";
  return c.floor ? tr(lang, "room", { room, floor: c.floor }) : room;
};
const className = (c: DayClass, lang: Lang) => (lang === "am" ? c.subjectAm || c.subjectEn : c.subjectEn);

/* ------------------------------------------------------------------ menu, welcome, help */

export function menuKeyboard(lang: Lang, siteUrl: string): Button[][] {
  return [
    [btn(tr(lang, "btnToday"), "t"), btn(tr(lang, "btnNext"), "n")],
    [btn(tr(lang, "btnLessons"), "ls"), btn(tr(lang, "btnHomework"), "hw")],
    [btn(tr(lang, "btnQuiz"), "qz"), btn(tr(lang, "btnRem"), "rm")],
    [btn(tr(lang, "btnSettings"), "st"), btn(tr(lang, "btnHelp"), "h")],
    [link(tr(lang, "btnSite"), siteUrl)],
  ];
}

const backRow = (lang: Lang, extra: Button[] = []): Button[] => [...extra, btn(tr(lang, "btnMenu"), "m")];

export function welcomeView(name: string, lang: Lang): View {
  return {
    html: card({ icon: "✨", title: tr(lang, "welcomeTitle", { name: name || "👋" }), sections: [tr(lang, "welcomeBody"), `🌐 ${tr("en", "chooseLanguage")} / ${tr("am", "chooseLanguage")}`] }),
    keyboard: [[btn("English", "l:en"), btn("አማርኛ", "l:am")]],
  };
}

export function menuView(lang: Lang, siteUrl: string, name?: string): View {
  return {
    html: card({
      icon: "◆",
      title: tr(lang, "menuTitle"),
      sections: [name ? `${tr(lang, "welcomeTitle", { name: esc(name) })} 👋\n${tr(lang, "menuPrompt")}` : tr(lang, "menuPrompt")],
    }),
    keyboard: menuKeyboard(lang, siteUrl),
  };
}

export function helpView(lang: Lang, remLimit: number, isAdmin: boolean): View {
  const admin = isAdmin ? "\n\n<b>Admin</b>\n/announce <i>text</i>\n/stats\n/notify <i>lesson</i>" : "";
  return {
    html: card({ icon: "❓", title: tr(lang, "helpTitle"), sections: [tr(lang, "helpBody") + admin], footer: tr(lang, "helpFooter", { limit: remLimit }) }),
    keyboard: [backRow(lang)],
  };
}

/* ------------------------------------------------------------------ schedule */

export function todayView(schedule: Schedule, nowMs: number, lang: Lang, siteUrl: string): View {
  const keyboard = [[btn(tr(lang, "btnRefresh"), "t"), btn(tr(lang, "btnNext"), "n")], [link(tr(lang, "btnSchedule"), `${siteUrl}/schedule`)], backRow(lang)];
  const p = addisParts(nowMs);
  const date = isoDate(p);
  const subtitle = dayLabel(date, p.weekday, lang);
  if (!schedule) return { html: card({ icon: "📅", title: tr(lang, "todayTitle"), subtitle, sections: [tr(lang, "noSchedule")] }), keyboard };

  const plan = planForDate(schedule.entries, schedule.overrides, date, p.weekday);
  if (plan.holiday) {
    const title = pick({ en: plan.holiday.titleEn ?? "", am: plan.holiday.titleAm ?? "" }, lang) || tr(lang, "noClassesToday");
    return { html: card({ icon: "📅", title: tr(lang, "todayTitle"), subtitle, sections: [`🎉 ${esc(tr(lang, "holiday", { title }))}`] }), keyboard };
  }
  if (!plan.classes.length) return { html: card({ icon: "📅", title: tr(lang, "todayTitle"), subtitle, sections: [tr(lang, "noClassesToday")] }), keyboard };

  const nowMin = p.secondOfDay / 60;
  const lines = plan.classes.map((c) => classLine(c, nowMin, lang));
  const done = plan.active.filter((c) => c.end <= nowMin).length;
  const total = plan.active.length;
  const progress = total ? `${bar(done / total)}  ${tr(lang, "classesDone", { done, total })}${done === total ? `\n${tr(lang, "allDone")}` : ""}` : "";
  return { html: card({ icon: "📅", title: tr(lang, "todayTitle"), subtitle, sections: [lines.join("\n\n"), progress] }), keyboard };
}

function classLine(c: DayClass, nowMin: number, lang: Lang): string {
  const time = `${clock(c.start, lang)} – ${clock(c.end, lang)}`;
  const name = esc(className(c, lang));
  const room = esc(roomLine(c, lang));
  const notes: string[] = [];
  let icon = "◻️";
  if (c.status === "cancelled") {
    icon = "✖️";
    notes.push(tr(lang, "stCancelled"));
  } else if (c.end <= nowMin) {
    icon = "✅";
  } else if (c.start <= nowMin) {
    icon = "▶️";
    notes.push(`<b>${tr(lang, "stNow")}</b> ${bar((nowMin - c.start) / (c.end - c.start), 5)}`);
  }
  if (c.status === "room_changed") notes.push(`🔁 ${esc(tr(lang, "stRoomChanged", { room: (lang === "am" ? c.originalRoomAm : c.originalRoomEn) ?? "" }))}`);
  if (c.status === "extra") notes.push(`➕ ${tr(lang, "stExtra")}`);
  if (c.status === "exam") notes.push(`📝 ${tr(lang, "stExam")}`);
  const note = pick({ en: c.noteEn ?? "", am: c.noteAm ?? "" }, lang);
  if (note) notes.push(`<i>${esc(note)}</i>`);
  const head = c.status === "cancelled" ? `${icon} <s>${name}</s>` : `${icon} <b>${name}</b>`;
  return [head, `     ${time}${room ? ` · ${room}` : ""}`, notes.length ? `     ${notes.join(" · ")}` : ""].filter(Boolean).join("\n");
}

export function nextView(schedule: Schedule, nowMs: number, lang: Lang, siteUrl: string): View {
  const keyboard = [[btn(tr(lang, "btnRefresh"), "n"), btn(tr(lang, "btnToday"), "t")], backRow(lang)];
  if (!schedule) return { html: card({ icon: "⏭", title: tr(lang, "nextTitle"), sections: [tr(lang, "noSchedule")] }), keyboard };
  const p = addisParts(nowMs);
  const date = isoDate(p);
  const st = scheduleStatusOn(schedule.entries, schedule.overrides, date, p.weekday, p.secondOfDay);
  const sections: string[] = [];
  if (st.kind === "class") {
    sections.push(`▶️ ${tr(lang, "nowInClass", { subject: esc(className(st.current, lang)), time: duration(st.minutesLeft, lang) })}\n${barPct(st.progress, 1)}`);
  }
  const next = st.next;
  if (!next) sections.push(tr(lang, "noUpcoming"));
  else {
    const c = next.entry as DayClass;
    const nextDate = addDays(date, next.daysAhead);
    const when =
      next.daysAhead === 0 ? tr(lang, "todayWord") : next.daysAhead === 1 ? tr(lang, "tomorrowWord") : dayLabel(nextDate, ((p.weekday - 1 + next.daysAhead) % 7) + 1, lang);
    const room = roomLine(c, lang);
    const extra = c.status === "exam" ? ` · 📝 ${tr(lang, "stExam")}` : c.status === "extra" ? ` · ➕ ${tr(lang, "stExtra")}` : c.status === "room_changed" ? " · 🔁" : "";
    sections.push(
      [`<b>${esc(className(c, lang))}</b>${extra}`, `🕑 ${esc(when)} · ${clock(c.start, lang)} – ${clock(c.end, lang)}`, room ? `📍 ${esc(room)}` : ""].filter(Boolean).join("\n"),
    );
    sections.push(`⏳ ${tr(lang, "startsIn", { time: duration(next.startsIn, lang) })}`);
  }
  if (siteUrl) keyboard.splice(1, 0, [link(tr(lang, "btnSchedule"), `${siteUrl}/schedule`)]);
  return { html: card({ icon: "⏭", title: tr(lang, "nextTitle"), sections }), keyboard };
}

/** Morning summary (7:00) for one language. */
export function summaryView(schedule: NonNullable<Schedule>, date: string, weekday: number, lang: Lang, siteUrl: string): View {
  const plan = planForDate(schedule.entries, schedule.overrides, date, weekday);
  const subtitle = dayLabel(date, weekday, lang);
  const keyboard = [[btn(tr(lang, "btnNext"), "n"), link(tr(lang, "btnSchedule"), `${siteUrl}/schedule`)]];
  if (plan.holiday) {
    const title = pick({ en: plan.holiday.titleEn ?? "", am: plan.holiday.titleAm ?? "" }, lang) || "🎉";
    return { html: card({ icon: "☀️", title: tr(lang, "summaryTitle"), subtitle, sections: [esc(tr(lang, "summaryHoliday", { title }))] }), keyboard };
  }
  const n = plan.active.length;
  const lines = plan.classes.map((c) => {
    const name = esc(className(c, lang));
    const room = esc(roomLine(c, lang));
    const flag = c.status === "cancelled" ? ` · ✖️ ${tr(lang, "stCancelled")}` : c.status === "room_changed" ? " · 🔁" : c.status === "exam" ? ` · 📝 ${tr(lang, "stExam")}` : c.status === "extra" ? ` · ➕` : "";
    const head = c.status === "cancelled" ? `<s>${name}</s>` : `<b>${name}</b>`;
    return `▸ ${clock(c.start, lang)}  ${head}${room ? `\n     ${room}` : ""}${flag}`;
  });
  return {
    html: card({ icon: "☀️", title: tr(lang, "summaryTitle"), subtitle, sections: [n === 1 ? tr(lang, "summaryLead1") : tr(lang, "summaryLead", { n }), lines.join("\n")], footer: tr(lang, "reminderFooter") }),
    keyboard,
  };
}

/** 15-minutes-before reminder for one language. */
export function reminderView(c: DayClass, minutesUntil: number, lang: Lang): View {
  const room = roomLine(c, lang);
  const min = Math.max(1, Math.ceil(minutesUntil - 1e-9));
  const note = pick({ en: c.noteEn ?? "", am: c.noteAm ?? "" }, lang);
  const changed = c.status === "room_changed" ? `\n🔁 ${esc(tr(lang, "stRoomChanged", { room: (lang === "am" ? c.originalRoomAm : c.originalRoomEn) ?? "" }))}` : "";
  return {
    html: card({
      icon: c.status === "exam" ? "📝" : "⏰",
      title: tr(lang, "reminderTitle", { min }),
      sections: [`${tr(lang, "reminderBody", { subject: esc(className(c, lang)), time: clock(c.start, lang) })}${room ? `\n📍 ${esc(room)}` : ""}${changed}${note ? `\n<i>${esc(note)}</i>` : ""}`],
      footer: tr(lang, "reminderFooter"),
    }),
    keyboard: [[btn(tr(lang, "btnToday"), "t"), btn(tr(lang, "btnMenu"), "m")]],
  };
}

/* ------------------------------------------------------------------ lessons + homework */

const subjectsWith = (lessons: BotLesson[], has: (l: BotLesson) => boolean) => SUBJECT_ORDER.filter((s) => lessons.some((l) => l.subject.slug === s && has(l)));

const lessonName = (l: BotLesson, lang: Lang) => `${l.code} ${pick(l.title, lang)}`;
const byNewest = (a: BotLesson, b: BotLesson) => b.createdAt.localeCompare(a.createdAt) || b.key.localeCompare(a.key);

function subjectButtons(slugs: readonly string[], prefix: string, lang: Lang, active?: string): Button[][] {
  const rows: Button[][] = [];
  for (let i = 0; i < slugs.length; i += 2) {
    rows.push(slugs.slice(i, i + 2).map((s) => btn(`${s === active ? "● " : ""}${SUBJECT_ICON[s] ?? "📘"} ${subjName(s, lang)}`, `${prefix}:${s}`)));
  }
  return rows;
}

/** Curriculum order: grade, unit, then lesson code (1.1.2 before 1.1.10). */
const byCurriculum = (a: BotLesson, b: BotLesson) => a.grade - b.grade || a.key.localeCompare(b.key, "en", { numeric: true });

/** Lessons as tappable links, with a "Grade 9 · Unit 1" line whenever the unit changes. */
function lessonLinks(list: BotLesson[], lang: Lang, siteUrl: string, details: boolean): string {
  let unit = "";
  const lines: string[] = [];
  for (const l of list) {
    const u = tr(lang, "lessonMeta", { grade: l.grade, unit: pick(l.unit, lang) });
    if (u !== unit) {
      lines.push(`<i>${esc(u)}</i>`);
      unit = u;
    }
    lines.push(`▸ <a href="${esc(siteUrl + lessonPath(l))}">${inlineHtml(lessonName(l, lang))}</a>`);
    if (details) {
      const extras = [l.quizCount ? `🎯 ${tr(lang, "quizCount", { n: l.quizCount })}` : "", l.homeworkCount ? `📝 ${tr(lang, "hwCount", { n: l.homeworkCount })}` : ""].filter(Boolean).join(" · ");
      if (extras) lines.push(`     ${extras}`);
    }
  }
  return lines.join("\n");
}

const lessonCount = (n: number, lang: Lang) => tr(lang, n === 1 ? "lessonCount1" : "lessonCount", { n });

/**
 * /lessons: EVERY published lesson, grouped by subject → grade · unit, each a link to the site. Subjects without
 * lessons are listed too ("no lessons yet"), and each subject has a button with more detail.
 */
export function lessonsView(lessons: BotLesson[], lang: Lang, siteUrl: string, subject?: string): View {
  const of = (s: string) => lessons.filter((l) => l.subject.slug === s).sort(byCurriculum);
  const back = backRow(lang, subject ? [btn(tr(lang, "btnBack"), "ls")] : []);

  if (subject) {
    const list = of(subject);
    const others = SUBJECT_ORDER.filter((s) => s !== subject);
    const html = list.length
      ? card({ icon: "📚", title: tr(lang, "lessonsTitle"), subtitle: `${SUBJECT_ICON[subject] ?? "📘"} ${subjName(subject, lang)} · ${lessonCount(list.length, lang)}`, sections: [lessonLinks(list, lang, siteUrl, true)] })
      : card({ icon: "📚", title: tr(lang, "lessonsTitle"), subtitle: `${SUBJECT_ICON[subject] ?? "📘"} ${subjName(subject, lang)}`, sections: [tr(lang, "subjectEmpty", { subject: subjName(subject, lang) })] });
    return {
      html,
      keyboard: [
        ...list.slice(0, 8).map((l) => [link(`📖 ${clipButton(lessonName(l, lang))}`, siteUrl + lessonPath(l))]),
        ...(list.length ? [] : subjectButtons(others, "ls", lang)),
        back,
      ],
    };
  }

  const build = (perSubject: number) => {
    const filled = SUBJECT_ORDER.filter((s) => of(s).length);
    const empty = SUBJECT_ORDER.filter((s) => !of(s).length);
    const sections = filled.map((s) => {
      const list = of(s);
      const shown = list.length > perSubject ? list.slice().sort(byNewest).slice(0, perSubject).sort(byCurriculum) : list;
      const more = list.length - shown.length;
      return [`${SUBJECT_ICON[s] ?? "📘"} <b>${esc(subjName(s, lang))}</b> · ${lessonCount(list.length, lang)}`, lessonLinks(shown, lang, siteUrl, false), more ? `<i>${tr(lang, "moreLessons", { n: more })}</i>` : ""]
        .filter(Boolean)
        .join("\n");
    });
    if (empty.length) sections.push(empty.map((s) => `${SUBJECT_ICON[s] ?? "📘"} <b>${esc(subjName(s, lang))}</b> · <i>${tr(lang, "noLessonsYet")}</i>`).join("\n"));
    sections.push(tr(lang, lessons.length ? "lessonsHint" : "noLessons"));
    return card({ icon: "📚", title: tr(lang, "lessonsTitle"), subtitle: tr(lang, "allLessons", { n: lessons.length }), sections });
  };
  // Everything fits for now; when the list grows past one message, each subject shows its newest lessons + "+n more".
  let html = build(Infinity);
  for (const n of [6, 3, 1]) if (html.length > TG_LIMITS.message - 200) html = build(n);
  return { html, keyboard: [...subjectButtons(SUBJECT_ORDER, "ls", lang), back] };
}

/** `done` = homework item ids done per lesson id (only for a linked site account), else null. */
export function homeworkView(lessons: BotLesson[], lang: Lang, siteUrl: string, subject: string | undefined, done: Map<string, string[]> | null): View {
  const withHw = lessons.filter((l) => l.homeworkCount > 0);
  const subjects = subjectsWith(lessons, (l) => l.homeworkCount > 0);
  const list = (subject ? withHw.filter((l) => l.subject.slug === subject) : withHw).slice().sort(byNewest).slice(0, 6);
  let total = 0;
  let finished = 0;
  const body = list.length
    ? list
        .map((l) => {
          const ids = new Set(l.homeworkIds);
          const d = done ? (done.get(l.id) ?? []).filter((x) => ids.has(x)).length : null;
          total += l.homeworkCount;
          finished += d ?? 0;
          const progress = d === null ? `📝 ${tr(lang, "hwCount", { n: l.homeworkCount })}` : `${barPct(d, l.homeworkCount)}  ${tr(lang, "hwProgress", { done: d, total: l.homeworkCount })}`;
          return `${SUBJECT_ICON[l.subject.slug] ?? "📘"} <b>${inlineHtml(lessonName(l, lang))}</b>\n${progress}`;
        })
        .join("\n\n")
    : tr(lang, "noHomework");
  const overall = done && list.length > 1 && total ? `<b>Σ</b> ${barPct(finished, total)}` : "";
  return {
    html: card({
      icon: "📝",
      title: tr(lang, "homeworkTitle"),
      subtitle: subject ? subjName(subject, lang) : undefined,
      sections: [body, overall, done === null && list.length ? tr(lang, "hwLinkHint") : ""],
    }),
    keyboard: [
      ...list.slice(0, 5).map((l) => [link(`📝 ${clipButton(lessonName(l, lang))}`, siteUrl + lessonPath(l, "homework"))]),
      ...(subjects.length > 1 ? subjectButtons(subjects, "hw", lang, subject) : []),
      backRow(lang, subject ? [btn(tr(lang, "btnBack"), "hw")] : []),
    ],
  };
}

/** Button labels: plain text, short. */
function clipButton(s: string): string {
  const t = s.replace(/\$([^$]+)\$/g, "$1").replace(/\*\*/g, "");
  return [...t].length > 40 ? [...t].slice(0, 39).join("") + "…" : t;
}

export function newLessonView(l: BotLesson, lang: Lang, siteUrl: string): View {
  const meta = tr(lang, "lessonMeta", { grade: l.grade, unit: pick(l.unit, lang) });
  const summary = pick(l.summary, lang);
  const extras = [l.minutes ? `⏱ ~${l.minutes} ${lang === "am" ? "ደቂቃ" : "min"}` : "", l.quizCount ? `🎯 ${tr(lang, "quizCount", { n: l.quizCount })}` : "", l.homeworkCount ? `📝 ${tr(lang, "hwCount", { n: l.homeworkCount })}` : ""]
    .filter(Boolean)
    .join(" · ");
  return {
    html: card({
      icon: "🆕",
      title: tr(lang, "newLessonTitle"),
      subtitle: `${subjName(l.subject.slug, lang)} · ${meta}`,
      sections: [`${tr(lang, "newLessonLead")}\n${SUBJECT_ICON[l.subject.slug] ?? "📘"} <b>${inlineHtml(lessonName(l, lang))}</b>`, summary ? `<blockquote>${inlineHtml(summary)}</blockquote>` : "", extras],
    }),
    keyboard: [[link(tr(lang, "btnOpenLesson"), siteUrl + lessonPath(l))], ...(l.quizCount ? [[btn(tr(lang, "btnQuiz"), `qz:${l.subject.slug}`)]] : [])],
  };
}

/* ------------------------------------------------------------------ quiz, settings, Rem */

export function quizPickView(subjects: string[], lang: Lang): View {
  return {
    html: card({ icon: "🎯", title: tr(lang, "quizTitle"), sections: [subjects.length ? tr(lang, "quizPick") : tr(lang, "quizNone")] }),
    keyboard: [...subjectButtons(subjects, "qz", lang), ...(subjects.length > 1 ? [[btn(tr(lang, "quizMixed"), "qz:all")]] : []), backRow(lang)],
  };
}

export function quizScoreView(score: number, total: number, lang: Lang, subject: string): View {
  const verdict = score === total ? tr(lang, "quizPerfect") : score / total >= 0.6 ? tr(lang, "quizGood") : tr(lang, "quizTry");
  return {
    html: card({ icon: score === total ? "🏆" : "🎯", title: tr(lang, "quizScoreTitle"), sections: [`${tr(lang, "quizScore", { score, total })}\n${barPct(score, total)}`, verdict] }),
    keyboard: [[btn(tr(lang, "quizAgain"), `qz:${subject}`), btn(tr(lang, "btnMenu"), "m")]],
  };
}

export function settingsView(lang: Lang, remindersOn: boolean, linkedUsername: string | null): View {
  return {
    html: card({
      icon: "⚙️",
      title: tr(lang, "settingsTitle"),
      sections: [
        `🌐 ${tr(lang, "setLanguage")}\n🔔 ${tr(lang, "setReminders", { state: tr(lang, remindersOn ? "on" : "off") })}\n👤 ${linkedUsername ? tr(lang, "setLinked", { username: esc(linkedUsername) }) : tr(lang, "setNotLinked")}`,
      ],
    }),
    keyboard: [
      [btn(`${lang === "en" ? "● " : ""}English`, "sl:en"), btn(`${lang === "am" ? "● " : ""}አማርኛ`, "sl:am")],
      [btn(tr(lang, remindersOn ? "btnRemindersOff" : "btnRemindersOn"), remindersOn ? "rem:0" : "rem:1")],
      ...(linkedUsername ? [[btn(tr(lang, "btnUnlink"), "ul")]] : []),
      backRow(lang),
    ],
  };
}

export function remIntroView(lang: Lang, left: number, limit: number): View {
  return {
    html: card({ icon: "💬", title: tr(lang, "remTitle"), sections: [tr(lang, "remIntro"), `${bar(left / limit)}  ${tr(lang, "remLeft", { n: left, limit })}`] }),
    keyboard: [backRow(lang)],
  };
}

/** "Asking Rem… (3/15 today)": sent at once as a placeholder, then edited into the answer. */
export function remAskingLine(used: number, limit: number, lang: Lang): string {
  return `<i>💬 ${tr(lang, "remAsking", { used, limit })}</i>`;
}

/** Rem's answer: a "💬 Rem · x/15 today" line, the converted HTML body, follow-up buttons (fu:0…2). */
export function remAnswerView(bodyHtml: string, followups: string[], used: number, limit: number, lang: Lang): View {
  return {
    html: clipHtml(`<i>💬 ${tr(lang, "remBadge", { used, limit })}</i>\n\n${bodyHtml}`, TG_LIMITS.message),
    keyboard: [...followups.map((q, i) => [btn(`💡 ${clipButton(q)}`, `fu:${i}`)]), backRow(lang)],
  };
}

export function announcementView(text: string, lang: Lang): View {
  return { html: card({ icon: "📣", title: tr(lang, "announceTitle"), sections: [esc(text)] }), keyboard: [] };
}

export function statsView(s: Record<string, number>): View {
  const rows = [
    ["👥 Subscribers", s.subscribers],
    ["🟢 Active", s.active],
    ["🔔 Reminders on", s.reminders],
    ["🗣 Amharic", s.amharic],
    ["🔗 Linked accounts", s.linked],
    ["🆕 New today", s.new_today],
    ["📥 Messages in today", s.received],
    ["📤 Messages out today", s.sent],
    ["💬 Rem questions today", s.rem_today],
    ["📚 Lessons announced", s.lessons_announced],
  ] as const;
  const active = s.subscribers ? `${barPct(s.active ?? 0, s.subscribers)} active` : "";
  return {
    html: card({ icon: "📊", title: "Bot stats", sections: [rows.map(([k, v]) => `${k}: <b>${v ?? 0}</b>`).join("\n"), active] }),
    keyboard: [[btn("🔄 Refresh", "ss"), btn("‹ Menu", "m")]],
  };
}
