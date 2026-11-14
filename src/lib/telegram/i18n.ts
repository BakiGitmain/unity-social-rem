/**
 * Every bot text in English and Amharic. Buttons are short (like the site's "ፈተናውን ጀምር"), sentences use the
 * polite form (እርስዎ), the same as the site. {name} placeholders are filled by `tr()`.
 * No secrets, pure data (used by the bot and by scripts/telegram-setup.ts).
 */
export type Lang = "en" | "am";

export const T = {
  /* ---------- welcome + menu ---------- */
  welcomeTitle: { en: "Welcome, {name}", am: "እንኳን ደህና መጡ፣ {name}" },
  welcomeBody: {
    en: "I'm your class companion for <b>Unity Social Rem</b> ✨\n\n⏰ Class reminders, 15 minutes before\n📚 New lessons the moment they're published\n📝 Homework and 🎯 quick quizzes\n💬 Rem, your study tutor, for any question",
    am: "እኔ የ<b>ዩኒቲ ሶሻል ሬም</b> የክፍል ጓደኛዎ ነኝ ✨\n\n⏰ ክፍለ ጊዜ ከመጀመሩ 15 ደቂቃ በፊት አሳስብዎታለሁ\n📚 አዲስ ትምህርት እንደወጣ አሳውቅዎታለሁ\n📝 የቤት ሥራ እና 🎯 ፈጣን ፈተናዎች\n💬 ሬም፣ የጥናት አጋዥዎ፣ ማንኛውንም ጥያቄ ይመልሳል",
  },
  chooseLanguage: { en: "Choose your language:", am: "ቋንቋ ይምረጡ፦" },
  menuTitle: { en: "Main menu", am: "ዋና ማውጫ" },
  menuPrompt: { en: "What would you like to do?", am: "ምን ላግዝዎት?" },

  btnToday: { en: "📅 Today", am: "📅 ዛሬ" },
  btnNext: { en: "⏭ Next class", am: "⏭ ቀጣይ ክፍለ ጊዜ" },
  btnLessons: { en: "📚 Lessons", am: "📚 ትምህርቶች" },
  btnHomework: { en: "📝 Homework", am: "📝 የቤት ሥራ" },
  btnQuiz: { en: "🎯 Quiz", am: "🎯 ፈተና" },
  btnRem: { en: "💬 Ask Rem", am: "💬 ሬምን ይጠይቁ" },
  btnSettings: { en: "⚙️ Settings", am: "⚙️ ቅንብሮች" },
  btnHelp: { en: "❓ Help", am: "❓ እገዛ" },
  btnSite: { en: "🌐 Open the site", am: "🌐 ድረ-ገጹን ክፈት" },
  btnMenu: { en: "‹ Menu", am: "‹ ማውጫ" },
  btnBack: { en: "‹ Back", am: "‹ ተመለስ" },
  btnRefresh: { en: "🔄 Refresh", am: "🔄 አድስ" },
  btnOpenLesson: { en: "Open lesson ↗", am: "ትምህርቱን ክፈት ↗" },
  btnOpenHomework: { en: "Open homework ↗", am: "የቤት ሥራውን ክፈት ↗" },
  btnSchedule: { en: "🗓 Full schedule ↗", am: "🗓 ሙሉ ፕሮግራም ↗" },

  /* ---------- schedule ---------- */
  todayTitle: { en: "Today", am: "ዛሬ" },
  noClassesToday: { en: "No classes today. Enjoy your rest 🌿", am: "ዛሬ ክፍለ ጊዜ የለም። መልካም እረፍት 🌿" },
  holiday: { en: "Holiday: {title}", am: "በዓል፦ {title}" },
  classesDone: { en: "{done} of {total} classes done", am: "{done}/{total} ክፍለ ጊዜዎች አልቀዋል" },
  allDone: { en: "You're done for today 🎉", am: "ለዛሬ ጨርሰዋል 🎉" },
  stNow: { en: "now", am: "አሁን" },
  stDone: { en: "done", am: "አልቋል" },
  stCancelled: { en: "cancelled", am: "ተሰርዟል" },
  stRoomChanged: { en: "room changed (was {room})", am: "ክፍል ተቀይሯል (የነበረው {room})" },
  stExtra: { en: "extra class", am: "ተጨማሪ ክፍለ ጊዜ" },
  stExam: { en: "exam", am: "ፈተና" },
  room: { en: "{room} · floor {floor}", am: "{room} · {floor}ኛ ፎቅ" },
  nextTitle: { en: "Next class", am: "ቀጣይ ክፍለ ጊዜ" },
  startsIn: { en: "Starts in <b>{time}</b>", am: "በ<b>{time}</b> ውስጥ ይጀምራል" },
  nowInClass: { en: "In class now: <b>{subject}</b>, ends in {time}", am: "አሁን ክፍል ውስጥ፦ <b>{subject}</b>፣ በ{time} ያልቃል" },
  noUpcoming: { en: "No upcoming classes in the next two weeks.", am: "በሚቀጥሉት ሁለት ሳምንታት ክፍለ ጊዜ የለም።" },
  todayWord: { en: "Today", am: "ዛሬ" },
  tomorrowWord: { en: "Tomorrow", am: "ነገ" },
  noSchedule: { en: "The class schedule isn't set up yet.", am: "የክፍለ ጊዜ ፕሮግራሙ ገና አልተዘጋጀም።" },

  /* ---------- reminders (sent by the tick) ---------- */
  reminderTitle: { en: "Class in {min} min", am: "ክፍለ ጊዜ በ{min} ደቂቃ" },
  reminderBody: { en: "<b>{subject}</b> starts at {time}", am: "<b>{subject}</b> በ{time} ይጀምራል" },
  reminderFooter: { en: "Turn reminders off in ⚙️ Settings", am: "ማሳሰቢያዎችን በ⚙️ ቅንብሮች ማጥፋት ይችላሉ" },
  summaryTitle: { en: "Good morning ☀️", am: "እንደምን አደሩ ☀️" },
  summaryLead: { en: "Today you have {n} classes:", am: "ዛሬ {n} ክፍለ ጊዜዎች አሉዎት፦" },
  summaryLead1: { en: "Today you have 1 class:", am: "ዛሬ 1 ክፍለ ጊዜ አለዎት፦" },
  summaryHoliday: { en: "No classes today: {title} 🌿", am: "ዛሬ ክፍለ ጊዜ የለም፦ {title} 🌿" },

  /* ---------- lessons ---------- */
  lessonsTitle: { en: "Lessons", am: "ትምህርቶች" },
  allLessons: { en: "All lessons · {n}", am: "ሁሉም ትምህርቶች · {n}" },
  lessonCount: { en: "{n} lessons", am: "{n} ትምህርቶች" },
  lessonCount1: { en: "1 lesson", am: "1 ትምህርት" },
  noLessonsYet: { en: "no lessons yet", am: "ገና ትምህርት የለም" },
  moreLessons: { en: "+{n} more: tap the subject below", am: "+{n} ተጨማሪ፦ ከታች የትምህርት ዓይነቱን ይንኩ" },
  lessonsHint: { en: "Tap a lesson to open it, or a subject for details.", am: "ለመክፈት ትምህርቱን ይንኩ፤ ለዝርዝር ደግሞ የትምህርት ዓይነቱን ይምረጡ።" },
  subjectEmpty: {
    en: "There are no {subject} lessons yet. As soon as one is added, I'll send you a message here 🌱",
    am: "እስካሁን የ{subject} ትምህርት አልተጨመረም። እንደተጨመረ ወዲያውኑ እዚህ መልዕክት እልክልዎታለሁ 🌱",
  },
  noLessons: { en: "No lessons here yet. They're coming soon 🌱", am: "እዚህ ገና ትምህርት የለም። በቅርቡ ይመጣሉ 🌱" },
  lessonMeta: { en: "Grade {grade} · {unit}", am: "{grade}ኛ ክፍል · {unit}" },
  quizCount: { en: "{n} quiz questions", am: "{n} የፈተና ጥያቄዎች" },
  hwCount: { en: "{n} homework exercises", am: "{n} የቤት ሥራ መልመጃዎች" },
  newLessonTitle: { en: "New lesson", am: "አዲስ ትምህርት" },
  newLessonLead: { en: "A new lesson is ready to study:", am: "አዲስ ትምህርት ለጥናት ዝግጁ ነው፦" },

  /* ---------- homework ---------- */
  homeworkTitle: { en: "Homework", am: "የቤት ሥራ" },
  noHomework: { en: "No homework right now 🎉", am: "አሁን የቤት ሥራ የለም 🎉" },
  hwProgress: { en: "{done}/{total} done", am: "{done}/{total} ተሠርቷል" },
  hwLinkHint: {
    en: "Want your progress here? On the site, open Profile → <b>Telegram bot</b> to connect your account.",
    am: "እድገትዎን እዚህ ማየት ይፈልጋሉ? በድረ-ገጹ ላይ መገለጫ → <b>Telegram bot</b> በመክፈት መለያዎን ያገናኙ።",
  },

  /* ---------- quiz ---------- */
  quizTitle: { en: "Quick quiz", am: "ፈጣን ፈተና" },
  quizPick: { en: "5 questions from the site's quizzes. Pick a subject:", am: "ከድረ-ገጹ ፈተናዎች 5 ጥያቄዎች። የትምህርት ዓይነት ይምረጡ፦" },
  quizMixed: { en: "🔀 Mixed", am: "🔀 ቅልቅል" },
  quizStart: { en: "Here we go! Answer each poll; the explanation appears right after.", am: "እንጀምር! እያንዳንዱን ጥያቄ ይመልሱ፤ ማብራሪያው ወዲያውኑ ይታያል።" },
  quizNone: { en: "No quiz questions here yet.", am: "እዚህ ገና የፈተና ጥያቄ የለም።" },
  quizScoreTitle: { en: "Quiz finished", am: "ፈተናው አልቋል" },
  quizScore: { en: "You scored <b>{score}/{total}</b>", am: "ውጤትዎ <b>{score}/{total}</b> ነው" },
  quizPerfect: { en: "Perfect score! 🏆", am: "ሙሉ ውጤት! 🏆" },
  quizGood: { en: "Great work! Keep going 💪", am: "በጣም ጥሩ! ይቀጥሉ 💪" },
  quizTry: { en: "Good try. Review the notes and play again 📖", am: "ጥሩ ሙከራ ነው። ማስታወሻዎቹን ከልሰው እንደገና ይሞክሩ 📖" },
  quizAgain: { en: "🎯 Play again", am: "🎯 እንደገና" },

  /* ---------- Rem ---------- */
  remTitle: { en: "Ask Rem", am: "ሬምን ይጠይቁ" },
  remIntro: {
    en: "Send me any school question, in English or Amharic. For example:\n<i>What is the difference between union and intersection?</i>\n\nTip: you can also type <code>/rem your question</code>.",
    am: "ማንኛውንም የትምህርት ጥያቄ በእንግሊዝኛ ወይም በአማርኛ ይላኩልኝ። ለምሳሌ፦\n<i>በውህደት እና በመገናኛ መካከል ያለው ልዩነት ምንድን ነው?</i>\n\nጠቃሚ ምክር፦ <code>/rem ጥያቄዎ</code> ብለውም መጻፍ ይችላሉ።",
  },
  remLeft: { en: "{n} of {limit} questions left today", am: "ለዛሬ ከ{limit} ጥያቄዎች {n} ቀርተዋል" },
  remAsking: { en: "Asking Rem… ({used}/{limit} today)", am: "ሬምን በመጠየቅ ላይ… (ዛሬ {used}/{limit})" },
  remBadge: { en: "Rem · {used}/{limit} today", am: "ሬም · ዛሬ {used}/{limit}" },
  remLimit: {
    en: "You've used all {limit} questions for today 🌙 They reset tomorrow (Addis Ababa time). Keep revising with the notes and the quiz!",
    am: "ለዛሬ ያሉዎትን {limit} ጥያቄዎች በሙሉ ተጠቅመዋል 🌙 ነገ (በአዲስ አበባ ሰዓት) ይታደሳሉ። በማስታወሻዎቹና በፈተናው ክለሳዎን ይቀጥሉ!",
  },
  remResting: {
    en: "Rem is resting right now 😴 Please come back a bit later. The notes and the quiz still work!",
    am: "ሬም አሁን እያረፈ ነው 😴 እባክዎ ትንሽ ቆይተው ይመለሱ። ማስታወሻዎቹና ፈተናው አሁንም ይሠራሉ!",
  },
  remFlagged: {
    en: "I can't help with that one 🙏 I'm here for school and studying. Ask me anything about your lessons!",
    am: "በዚያ ጉዳይ መርዳት አልችልም 🙏 እኔ ለትምህርትና ለጥናት ነው ያለሁት። ስለ ትምህርቶችዎ ማንኛውንም ይጠይቁኝ!",
  },
  remError: { en: "Something went wrong. Please try again.", am: "ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።" },
  remTooLong: { en: "That's a bit long. Please keep your question under 800 characters.", am: "ጥያቄው ትንሽ ረዘመ። እባክዎ ከ800 ፊደላት በታች ያድርጉት።" },
  remFollowupGone: { en: "That suggestion has expired. Just type your question 🙂", am: "ያ ጥቆማ ጊዜው አልፎበታል። ጥያቄዎን ብቻ ይጻፉ 🙂" },

  /* ---------- settings ---------- */
  settingsTitle: { en: "Settings", am: "ቅንብሮች" },
  setLanguage: { en: "Language: <b>English</b>", am: "ቋንቋ፦ <b>አማርኛ</b>" },
  setReminders: { en: "Class reminders: <b>{state}</b>", am: "የክፍለ ጊዜ ማሳሰቢያ፦ <b>{state}</b>" },
  on: { en: "on", am: "በርቷል" },
  off: { en: "off", am: "ጠፍቷል" },
  setLinked: { en: "Site account: <b>@{username}</b>", am: "የድረ-ገጽ መለያ፦ <b>@{username}</b>" },
  setNotLinked: { en: "Site account: not connected", am: "የድረ-ገጽ መለያ፦ አልተገናኘም" },
  btnRemindersOn: { en: "🔔 Turn reminders on", am: "🔔 ማሳሰቢያ አብራ" },
  btnRemindersOff: { en: "🔕 Turn reminders off", am: "🔕 ማሳሰቢያ አጥፋ" },
  btnUnlink: { en: "Disconnect account", am: "መለያውን አላቅቅ" },
  langSaved: { en: "Language: English ✓", am: "ቋንቋ፦ አማርኛ ✓" },
  remindersOnToast: { en: "Reminders on 🔔", am: "ማሳሰቢያ በርቷል 🔔" },
  remindersOffToast: { en: "Reminders off 🔕", am: "ማሳሰቢያ ጠፍቷል 🔕" },
  unlinked: { en: "Account disconnected", am: "መለያው ተላቋል" },

  /* ---------- link ---------- */
  linkedTitle: { en: "Account connected", am: "መለያ ተገናኝቷል" },
  linkedBody: { en: "This chat is now connected to <b>@{username}</b>. Homework progress will show here.", am: "ይህ ውይይት ከ<b>@{username}</b> ጋር ተገናኝቷል። የቤት ሥራ እድገትዎ እዚህ ይታያል።" },
  linkBad: { en: "That link has expired. Open Profile → Telegram bot on the site again.", am: "ያ ሊንክ ጊዜው አልፎበታል። በድረ-ገጹ ላይ መገለጫ → Telegram bot እንደገና ይክፈቱ።" },

  /* ---------- help ---------- */
  helpTitle: { en: "Help", am: "እገዛ" },
  helpBody: {
    en: "/today: today's classes\n/next: the next class, with a countdown\n/lessons: latest lessons by subject\n/homework: homework per subject\n/quiz: a quick 5-question quiz\n/rem <i>question</i>: ask Rem, your study tutor\n/settings: language and reminders\n/help: this list",
    am: "/today፦ የዛሬ ክፍለ ጊዜዎች\n/next፦ ቀጣዩ ክፍለ ጊዜ እና የቀረው ጊዜ\n/lessons፦ የቅርብ ጊዜ ትምህርቶች በየትምህርት ዓይነቱ\n/homework፦ የቤት ሥራ በየትምህርት ዓይነቱ\n/quiz፦ ባለ 5 ጥያቄ ፈጣን ፈተና\n/rem <i>ጥያቄ</i>፦ የጥናት አጋዥዎን ሬምን ይጠይቁ\n/settings፦ ቋንቋ እና ማሳሰቢያዎች\n/help፦ ይህ ዝርዝር",
  },
  helpFooter: { en: "Questions to Rem: {limit} per day", am: "ለሬም የሚቀርቡ ጥያቄዎች፦ በቀን {limit}" },
  unknown: { en: "I didn't get that. Try /help 🙂", am: "አልገባኝም። /help ይሞክሩ 🙂" },
  groupOnly: { en: "Please talk to me in a private chat 🙂", am: "እባክዎ በግል ውይይት ያነጋግሩኝ 🙂" },

  /* ---------- admin ---------- */
  admAnnounceUsage: { en: "Usage: /announce your message", am: "አጠቃቀም፦ /announce መልእክትዎ" },
  admPreview: { en: "Preview. Send this to {n} subscribers?", am: "ቅድመ እይታ። ይህ ለ{n} ተመዝጋቢዎች ይላክ?" },
  admConfirm: { en: "✅ Send", am: "✅ ላክ" },
  admCancel: { en: "✖ Cancel", am: "✖ ሰርዝ" },
  admCancelled: { en: "Cancelled. Nothing was sent.", am: "ተሰርዟል። ምንም አልተላከም።" },
  admSent: { en: "Sent to {sent} of {total}. Blocked or failed: {failed}.", am: "ከ{total} ለ{sent} ተልኳል። የታገዱ ወይም ያልደረሱ፦ {failed}።" },
  admSending: { en: "Sending…", am: "በመላክ ላይ…" },
  admNothing: { en: "There is nothing to confirm.", am: "የሚረጋገጥ ነገር የለም።" },
  announceTitle: { en: "Announcement", am: "ማስታወቂያ" },
  statsTitle: { en: "Bot stats", am: "የቦቱ መረጃ" },
  admNotifyUsage: {
    en: "Usage: /notify <code>subject/grade/unit/lesson</code>, e.g. <code>/notify mathematics/grade-9/unit-1/1-1</code> or <code>/notify geography 1.1.3</code>",
    am: "አጠቃቀም፦ /notify <code>subject/grade/unit/lesson</code>፣ ለምሳሌ <code>/notify mathematics/grade-9/unit-1/1-1</code> ወይም <code>/notify geography 1.1.3</code>",
  },
  admNotFound: { en: "No published lesson matches “{q}”.", am: "ከ“{q}” ጋር የሚመሳሰል የታተመ ትምህርት የለም።" },
  admAmbiguous: { en: "More than one lesson matches. Use the full path:", am: "ከአንድ በላይ ትምህርት ይመሳሰላል። ሙሉውን መንገድ ይጠቀሙ፦" },
} as const satisfies Record<string, Record<Lang, string>>;

export type TKey = keyof typeof T;

export function tr(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let s: string = T[key][lang];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export const WEEKDAYS: Record<Lang, string[]> = {
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  am: ["ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "ዓርብ", "ቅዳሜ", "እሁድ"],
};
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthEn = (m: number) => MONTHS_EN[m - 1] ?? "";

/* ---------- bot profile (scripts/telegram-setup.ts) ---------- */

/** The command menu (setMyCommands), per language. Descriptions ≤ 256 chars, commands lowercase. */
export const COMMANDS: Record<Lang, { command: string; description: string }[]> = {
  en: [
    { command: "start", description: "Welcome and main menu" },
    { command: "today", description: "Today's classes" },
    { command: "next", description: "Next class, with a countdown" },
    { command: "lessons", description: "Latest lessons by subject" },
    { command: "homework", description: "Homework per subject" },
    { command: "quiz", description: "Quick 5-question quiz" },
    { command: "rem", description: "Ask Rem, your study tutor" },
    { command: "settings", description: "Language and reminders" },
    { command: "help", description: "All commands" },
  ],
  am: [
    { command: "start", description: "እንኳን ደህና መጡ እና ዋና ማውጫ" },
    { command: "today", description: "የዛሬ ክፍለ ጊዜዎች" },
    { command: "next", description: "ቀጣዩ ክፍለ ጊዜ እና የቀረው ጊዜ" },
    { command: "lessons", description: "የቅርብ ጊዜ ትምህርቶች" },
    { command: "homework", description: "የቤት ሥራ በየትምህርት ዓይነቱ" },
    { command: "quiz", description: "ባለ 5 ጥያቄ ፈጣን ፈተና" },
    { command: "rem", description: "የጥናት አጋዥዎን ሬምን ይጠይቁ" },
    { command: "settings", description: "ቋንቋ እና ማሳሰቢያዎች" },
    { command: "help", description: "ሁሉም ትዕዛዞች" },
  ],
};

/** Extra admin-only commands (shown only in the admin's chat). */
export const ADMIN_COMMANDS: { command: string; description: string }[] = [
  { command: "announce", description: "Broadcast a message (preview first)" },
  { command: "stats", description: "Subscribers and messages today" },
  { command: "notify", description: "Announce a lesson by hand" },
];

/** Bot description (empty chat screen, ≤ 512) and short description (profile, ≤ 120). */
export const DESCRIPTION: Record<Lang, { description: string; short: string }> = {
  en: {
    description:
      "Unity Social Rem class companion ✨\n\n⏰ Class reminders 15 minutes before\n📚 New lessons as soon as they're published\n📝 Homework and 🎯 quick quizzes\n💬 Rem, your study tutor\n\nEnglish and Amharic. Tap Start!",
    short: "Class reminders, new lessons, homework, quizzes and Rem, your study tutor. English + Amharic.",
  },
  am: {
    description:
      "የዩኒቲ ሶሻል ሬም የክፍል ጓደኛ ✨\n\n⏰ ክፍለ ጊዜ ከመጀመሩ 15 ደቂቃ በፊት ማሳሰቢያ\n📚 አዲስ ትምህርት እንደወጣ ማሳወቂያ\n📝 የቤት ሥራ እና 🎯 ፈጣን ፈተናዎች\n💬 ሬም፣ የጥናት አጋዥዎ\n\nበእንግሊዝኛ እና በአማርኛ። Start ይጫኑ!",
    short: "የክፍለ ጊዜ ማሳሰቢያ፣ አዲስ ትምህርቶች፣ የቤት ሥራ፣ ፈተናዎች እና የጥናት አጋዥዎ ሬም።",
  },
};
