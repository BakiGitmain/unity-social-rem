import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAddisLocal } from "../time/clock.ts";
import type { ClassEntry } from "../time/schedule.ts";
import { TG_LIMITS } from "./format.ts";
import { COMMANDS, DESCRIPTION, T } from "./i18n.ts";
import type { BotLesson } from "./lessons.ts";
import { clock, dayLabel, homeworkView, lessonsView, menuKeyboard, newLessonView, nextView, quizScoreView, reminderView, remAnswerView, remAskingLine, settingsView, summaryView, todayView, welcomeView, type View } from "./views.ts";

const SITE = "https://unity-social-rem.vercel.app";
const at = (s: string) => parseAddisLocal(s)!;
const m = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const entry = (id: string, day: number, start: string, end: string, subject: string, en: string, am: string): ClassEntry => ({
  id, day, start: m(start), end: m(end), periodLabel: "", periodStart: 1, periodEnd: 2, subject, subjectEn: en, subjectAm: am, roomEn: "Room 12", roomAm: "ክፍል 12", floor: 2,
});
const SCHEDULE = {
  entries: [entry("a", 1, "08:00", "09:00", "mathematics", "Mathematics", "ሒሳብ"), entry("b", 1, "14:30", "16:25", "geography", "Geography", "ጂኦግራፊ")],
  overrides: [],
};
const LESSON: BotLesson = {
  id: "m1",
  key: "mathematics/grade-9/unit-1/1-1",
  code: "1.1",
  title: { en: "Sets & $A \\cup B$", am: "ስብስቦች" },
  summary: { en: "Sets, <elements> and operations.", am: "ስብስቦች፣ አባላት እና ስሌቶች።" },
  subject: { slug: "mathematics", name: { en: "Mathematics", am: "ሒሳብ" } },
  grade: 9,
  unit: { en: "Unit 1", am: "ምዕራፍ 1" },
  createdAt: "2026-11-11T14:55:32Z",
  homeworkCount: 4,
  homeworkIds: ["h1", "h2", "h3", "h4"],
  quizCount: 28,
  minutes: 40,
};

/** Every view must be valid Telegram output: balanced tags, short enough, valid buttons. */
function valid(v: View) {
  assert.ok(v.html.length > 0 && v.html.length <= TG_LIMITS.message, "length");
  for (const tag of ["b", "i", "s", "code", "pre", "blockquote", "a"]) {
    const open = (v.html.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;
    const close = (v.html.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
    assert.equal(open, close, `<${tag}> balanced`);
  }
  assert.ok(!/<(?!\/?(b|i|u|s|code|pre|blockquote|a)[ >])/.test(v.html), "only Telegram tags");
  for (const row of v.keyboard)
    for (const b of row) {
      assert.ok(b.text.length > 0);
      if (b.callback_data !== undefined) assert.ok(Buffer.byteLength(b.callback_data) <= TG_LIMITS.callbackData);
      if (b.url !== undefined) assert.match(b.url, /^https:\/\//);
    }
}

test("every English text has an Amharic version (and no empty strings)", () => {
  for (const [k, v] of Object.entries(T)) {
    assert.ok(v.en.trim(), `${k}.en`);
    assert.ok(v.am.trim(), `${k}.am`);
    assert.ok(k.startsWith("adm") || k === "on" || k === "off" || /[ሀ-፿]/.test(v.am) || /^[\W\d]*$/.test(v.am), `${k}.am is Amharic`);
  }
});

test("bot profile texts fit Telegram's limits", () => {
  for (const lang of ["en", "am"] as const) {
    assert.ok(DESCRIPTION[lang].description.length <= 512);
    assert.ok(DESCRIPTION[lang].short.length <= 120);
    assert.equal(COMMANDS[lang].length, 9);
    for (const c of COMMANDS[lang]) assert.match(c.command, /^[a-z0-9_]{1,32}$/);
  }
});

test("clock: 12 h in English, Ethiopian clock (+24 h) in Amharic", () => {
  assert.equal(clock(m("14:30"), "en"), "2:30 PM");
  assert.equal(clock(m("14:30"), "am"), "8:30 ከሰዓት (14:30)");
  assert.equal(clock(m("08:00"), "am"), "2:00 ጠዋት (08:00)");
  assert.equal(dayLabel("2026-11-16", 1, "en"), "Monday · Nov 16");
  assert.match(dayLabel("2026-11-16", 1, "am"), /^ሰኞ · ኅዳር 7, 2019 ዓ\.ም$/);
});

test("welcome + menu", () => {
  const w = welcomeView("Abebe <3", "en");
  valid(w);
  assert.match(w.html, /^✨ <b>WELCOME, ABEBE &lt;3<\/b>/);
  assert.deepEqual(w.keyboard[0]!.map((b) => b.callback_data), ["l:en", "l:am"]);
  const kb = menuKeyboard("am", SITE);
  assert.equal(kb.flat().length, 9);
  assert.equal(kb[0]![0]!.text, "📅 ዛሬ");
});

test("/today: statuses, progress bar, both languages", () => {
  const v = todayView(SCHEDULE, at("2026-11-16T15:00"), "en", SITE);
  valid(v);
  assert.match(v.html, /📅 <b>TODAY<\/b>\n<i>Monday · Nov 16<\/i>/);
  assert.match(v.html, /✅ <b>Mathematics<\/b>\n {5}8:00 AM – 9:00 AM · Room 12 · floor 2/);
  assert.match(v.html, /▶️ <b>Geography<\/b>/);
  assert.match(v.html, /<b>now<\/b> ▰▱▱▱▱/);
  assert.match(v.html, /▰▰▰▰▰▱▱▱▱▱ {2}1 of 2 classes done/);
  const am = todayView(SCHEDULE, at("2026-11-16T15:00"), "am", SITE);
  valid(am);
  assert.match(am.html, /<b>ጂኦግራፊ<\/b>/);
  assert.match(am.html, /ክፍል 12 · 2ኛ ፎቅ/);
  assert.match(am.html, /1\/2 ክፍለ ጊዜዎች አልቀዋል/);
  const rest = todayView(SCHEDULE, at("2026-11-18T09:00"), "en", SITE);
  assert.match(rest.html, /No classes today/);
});

test("/next: countdown and the class in progress", () => {
  const v = nextView(SCHEDULE, at("2026-11-16T12:15"), "en", SITE);
  valid(v);
  assert.match(v.html, /<b>Geography<\/b>\n🕑 Today · 2:30 PM – 4:25 PM\n📍 Room 12 · floor 2/);
  assert.match(v.html, /⏳ Starts in <b>2 h 15 min<\/b>/);
  const during = nextView(SCHEDULE, at("2026-11-16T08:30"), "am", SITE);
  valid(during);
  assert.match(during.html, /አሁን ክፍል ውስጥ፦ <b>ሒሳብ<\/b>፣ በ30 ደቂቃ ያልቃል/);
  const weekend = nextView(SCHEDULE, at("2026-11-21T10:00"), "en", SITE);
  assert.match(weekend.html, /Monday · Nov 23 · 8:00 AM/);
});

test("reminder + morning summary", () => {
  const r = reminderView({ ...SCHEDULE.entries[1]!, status: "room_changed", originalRoomEn: "Room 12", roomEn: "Lab 3" }, 15, "en");
  valid(r);
  assert.match(r.html, /⏰ <b>CLASS IN 15 MIN<\/b>/);
  assert.match(r.html, /<b>Geography<\/b> starts at 2:30 PM\n📍 Lab 3 · floor 2\n🔁 room changed \(was Room 12\)/);
  const s = summaryView(SCHEDULE, "2026-11-16", 1, "am", SITE);
  valid(s);
  assert.match(s.html, /ዛሬ 2 ክፍለ ጊዜዎች አሉዎት፦/);
});

test("lessons, homework and the new-lesson card", () => {
  const l = lessonsView([LESSON], "en", SITE);
  valid(l);
  assert.match(l.html, /<a href="https:\/\/unity-social-rem\.vercel\.app\/mathematics\/grade-9\/unit-1\/1-1">1\.1 Sets &amp; A ∪ B<\/a>/);
  assert.deepEqual(l.keyboard.flat().map((b) => b.callback_data), ["ls:mathematics", "ls:english", "ls:geography", "ls:history", "m"]);

  const unlinked = homeworkView([LESSON], "en", SITE, undefined, null);
  valid(unlinked);
  assert.match(unlinked.html, /📝 4 homework exercises/);
  assert.match(unlinked.html, /connect your account/);
  assert.equal(unlinked.keyboard[0]![0]!.url, `${SITE}/mathematics/grade-9/unit-1/1-1?tab=homework`);
  const linked = homeworkView([LESSON], "am", SITE, "mathematics", new Map([["m1", ["h1", "h3", "w1"]]]));
  valid(linked);
  assert.match(linked.html, /▰▰▰▰▰▱▱▱▱▱ 50% {2}2\/4 ተሠርቷል/); // the warm-up "w1" is not counted

  const n = newLessonView(LESSON, "en", SITE);
  valid(n);
  assert.match(n.html, /<blockquote>Sets, &lt;elements&gt; and operations\.<\/blockquote>/);
  assert.match(n.html, /⏱ ~40 min · 🎯 28 quiz questions · 📝 4 homework exercises/);
});

test("quiz score, settings, Rem answer", () => {
  const q = quizScoreView(4, 5, "en", "all");
  valid(q);
  assert.match(q.html, /You scored <b>4\/5<\/b>\n▰▰▰▰▰▰▰▰▱▱ 80%/);
  valid(settingsView("am", false, "selam"));
  assert.match(settingsView("am", false, null).html, /ጠፍቷል/);
  const r = remAnswerView("<b>A ∪ B</b>", ["What is a set?", "x".repeat(80)], 3, 15, "en");
  valid(r);
  assert.deepEqual(r.keyboard.slice(0, 2).map((row) => row[0]!.callback_data), ["fu:0", "fu:1"]);
  assert.equal(r.html, "<i>💬 Rem · 3/15 today</i>\n\n<b>A ∪ B</b>");
  assert.equal(remAnswerView("ሰላም", [], 15, 15, "am").html, "<i>💬 ሬም · ዛሬ 15/15</i>\n\nሰላም");
  assert.equal(remAskingLine(3, 15, "en"), "<i>💬 Asking Rem… (3/15 today)</i>");
});

test("/lessons lists EVERY published lesson, every subject (empty ones say so)", () => {
  const geo = (code: string, created: string): BotLesson => ({
    ...LESSON,
    id: `g${code}`,
    key: `geography/grade-9/unit-1/${code.replaceAll(".", "-")}`,
    code,
    title: { en: `Geo ${code}`, am: `ጂኦ ${code}` },
    subject: { slug: "geography", name: { en: "Geography", am: "ጂኦግራፊ" } },
    createdAt: created,
  });
  const all = [LESSON, ...["1.1.1", "1.1.2", "1.1.3", "1.1.4", "1.1.5", "1.1.10"].map((c, i) => geo(c, `2026-11-0${i + 1}T00:00:00Z`))];
  for (const lang of ["en", "am"] as const) {
    const v = lessonsView(all, lang, SITE);
    valid(v);
    assert.equal((v.html.match(/<a href=/g) ?? []).length, 7, "all 7 lessons are links");
    assert.ok(v.html.indexOf("1.1.2") < v.html.indexOf("1.1.10"), "curriculum order (1.1.2 before 1.1.10)");
  }
  const en = lessonsView(all, "en", SITE);
  assert.match(en.html, /<i>All lessons · 7<\/i>/);
  assert.match(en.html, /🌍 <b>Geography<\/b> · 6 lessons\n<i>Grade 9 · Unit 1<\/i>\n▸ <a /);
  assert.match(en.html, /🏛 <b>History<\/b> · <i>no lessons yet<\/i>/);
  assert.match(lessonsView(all, "am", SITE).html, /🏛 <b>ታሪክ<\/b> · <i>ገና ትምህርት የለም<\/i>/);

  const history = lessonsView(all, "en", SITE, "history");
  valid(history);
  assert.match(history.html, /no History lessons yet/);
  assert.ok(history.keyboard.flat().some((b) => b.callback_data === "ls:geography"), "other subjects offered");
  const g = lessonsView(all, "am", SITE, "geography");
  valid(g);
  assert.match(g.html, /ጂኦግራፊ · 6 ትምህርቶች/);
  assert.equal(g.keyboard.filter((row) => row[0]!.url).length, 6, "an Open button per lesson");

  // Many lessons still fit in one message (each subject then shows its newest + "+n more").
  const many = Array.from({ length: 120 }, (_, i) => geo(`1.${i + 1}`, `2026-10-01T00:${String(i % 60).padStart(2, "0")}:00Z`));
  const big = lessonsView(many, "en", SITE);
  valid(big);
  assert.match(big.html, /\+\d+ more: tap the subject below/);
});

test("reminder and /next have no countdown bar that never fills", () => {
  const r = reminderView(SCHEDULE.entries[1]! as Parameters<typeof reminderView>[0], 15, "en");
  assert.ok(!/[▰▱]/.test(r.html));
  const n = nextView(SCHEDULE, at("2026-11-16T12:15"), "en", SITE);
  assert.ok(!/[▰▱]/.test(n.html));
  // The class in progress keeps its real progress bar.
  assert.match(nextView(SCHEDULE, at("2026-11-16T08:30"), "en", SITE).html, /▰▰▰▰▰▱▱▱▱▱ 50%/);
});
