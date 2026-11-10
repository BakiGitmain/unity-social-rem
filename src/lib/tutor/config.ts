/**
 * Shared settings for the AI study tutor "Rem" (safe for the browser: no secrets here).
 * The OpenAI key lives in OPENAI_API_KEY; the model in OPENAI_MODEL (or the admin override in app_settings.ai).
 * Daily limits / model / prompt / budget can be changed in Admin → AI tutor (stored in the database).
 */
export const TUTOR = {
  /** Default questions per user per Addis Ababa day (admin setting + per-user override win). */
  dailyMessages: 30,
  /** Default web searches per user per day. */
  dailySearches: 3,
  /** Max characters in one student message. */
  maxInputChars: 800,
  /** Only the last N chat messages are sent to the model. */
  historyMessages: 8,
  /** The current lesson part sent as context, ~1,500 tokens. */
  contextChars: 6000,
  /** Max tokens the model may write per answer (answers are meant to be short). */
  maxOutputTokens: 350,
  /** Amharic needs ~3x more tokens per word, so Amharic answers get a bit more room. */
  maxOutputTokensAmharic: 600,
  /** Saved chat history per lesson (messages). */
  savedMessages: 40,
  /** Selected text for "Explain further". */
  selectionMin: 3,
  selectionMax: 300,
} as const;

/** Where the student is when asking: Learn mode, Read all, or Main Topics, plus the part index. */
export type TutorView = "learn" | "all" | "topics";

export type TutorRequestContext = {
  lessonId: string;
  view: TutorView;
  /** 0-based part index (ignored for "topics"). */
  part: number;
};

/** "quiz" forces one multiple-choice question as structured data. */
export type TutorIntent = "chat" | "quiz";

/** Metadata the server attaches to each assistant message. */
export type TutorMessageMeta = {
  messagesLeft?: number;
  limitReached?: boolean;
  /** Rem is switched off (kill switch) or the monthly budget is used up. */
  resting?: boolean;
};

/** The quiz tool's structured question. */
export type TutorQuiz = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

export const QUIZ_TOOL = "quiz_question";

/** The answer ends with this line; the UI turns it into follow-up chips and hides it. */
export const FOLLOWUPS_MARK = "FOLLOWUPS:";

/** Typed asks for a quiz (the 🎯 chip sends intent "quiz" directly). */
export const QUIZ_RE = /\b(quiz|test) me\b|\bquiz\b|\bask me (a )?question|ፈትነኝ|ጥያቄ ጠይቀኝ/i;

/** Questions that may need fresh facts. Only then is the (slower, pricier) web search tool offered. */
export const SEARCH_RE =
  /\b(search|look up|google|latest|current(ly)?|recent(ly)?|today|news|right now|this year|20[2-3][0-9]|population of)\b|ፈልግ|አሁን ያለ/i;
