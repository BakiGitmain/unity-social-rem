import type { Bi, Lang } from "@/lib/types";

/** UI labels for the study page. In "both" mode UI labels stay English. */
const UI = {
  fullNotes: { en: "Full Notes", am: "ሙሉ ማስታወሻ" },
  mainTopics: { en: "Main Topics", am: "ዋና ዋና ነጥቦች" },
  quiz: { en: "Quiz", am: "ፈተና" },
  minutes: { en: "min read", am: "ደቂቃ ንባብ" },
  sections: { en: "sections", am: "ክፍሎች" },
  questions: { en: "questions", am: "ጥያቄዎች" },
  onThisPage: { en: "In this lesson", am: "በዚህ ትምህርት" },
  topicsIntro: {
    en: "The most important points of this lesson, short and simple. Perfect for quick revision.",
    am: "የዚህ ትምህርት በጣም አስፈላጊ ነጥቦች፣ በአጭሩና በቀላሉ። ለፈጣን ክለሳ ተስማሚ።",
  },
  startQuiz: { en: "Start Quiz", am: "ፈተናውን ጀምር" },
  quizIntro: {
    en: "One question at a time with instant feedback. Your notes will be hidden while you take the quiz, so you can focus.",
    am: "በአንድ ጊዜ አንድ ጥያቄ፣ ወዲያውኑ ግብረ መልስ ያገኛሉ። ፈተናውን በሚወስዱበት ጊዜ እንዲያተኩሩ ማስታወሻዎቹ ይደበቃሉ።",
  },
  focusMode: { en: "Focus mode", am: "የትኩረት ሁኔታ" },
  notesHidden: { en: "Notes are hidden until you finish", am: "እስኪጨርሱ ድረስ ማስታወሻዎቹ ተደብቀዋል" },
  cancelQuiz: { en: "Cancel quiz", am: "ፈተናውን አቋርጥ" },
  question: { en: "Question", am: "ጥያቄ" },
  of: { en: "of", am: "ከ" },
  correct: { en: "Correct!", am: "ትክክል!" },
  incorrect: { en: "Not quite", am: "ትክክል አይደለም" },
  explanation: { en: "Explanation", am: "ማብራሪያ" },
  nextQuestion: { en: "Next question", am: "ቀጣይ ጥያቄ" },
  seeResults: { en: "See my score", am: "ውጤቴን አሳይ" },
  yourScore: { en: "Your score", am: "ውጤትዎ" },
  reviewMistakes: { en: "Review mistakes", am: "ስህተቶችን ይከልሱ" },
  tryAgain: { en: "Try again", am: "እንደገና ይሞክሩ" },
  backToNotes: { en: "Back to notes", am: "ወደ ማስታወሻው ተመለስ" },
  yourAnswer: { en: "Your answer", am: "የእርስዎ መልስ" },
  correctAnswer: { en: "Correct answer", am: "ትክክለኛው መልስ" },
  noMistakes: { en: "No mistakes to review. Perfect score!", am: "የሚከለሱ ስህተቶች የሉም። ሙሉ ውጤት!" },
  loadingQuiz: { en: "Loading questions…", am: "ጥያቄዎች በመጫን ላይ…" },
  quizError: { en: "Could not load the quiz. Check your connection and try again.", am: "ፈተናውን መጫን አልተቻለም። ግንኙነትዎን አረጋግጠው እንደገና ይሞክሩ።" },
  retry: { en: "Retry", am: "እንደገና ሞክር" },
  noQuiz: { en: "There is no quiz for this lesson yet.", am: "ለዚህ ትምህርት እስካሁን ፈተና የለም።" },
  prevLesson: { en: "Previous", am: "ያለፈው" },
  nextLesson: { en: "Next", am: "ቀጣዩ" },
  excellent: { en: "Excellent work!", am: "በጣም ጥሩ ሥራ!" },
  good: { en: "Good job! Review the ones you missed.", am: "ጥሩ ነው! ያመለጡዎትን ይከልሱ።" },
  keepGoing: { en: "Keep going! Read the notes again, then retry.", am: "ይቀጥሉ! ማስታወሻውን እንደገና አንብበው ይሞክሩ።" },
  credit: { en: "Credit", am: "ምንጭ" },
} satisfies Record<string, Bi>;

export type UIKey = keyof typeof UI;

/** UI label: Amharic only in "am" mode; English in "en" and "both". */
export function ui(key: UIKey, lang: Lang) {
  return lang === "am" ? UI[key].am : UI[key].en;
}

/** Picks one side of a bilingual DB row for UI chrome (titles etc.). */
export function pick(en: string, am: string, lang: Lang) {
  return lang === "am" ? am : en;
}
