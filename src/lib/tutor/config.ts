/**
 * Shared settings for the AI study tutor "Rem" (safe for the browser: no secrets here).
 * The OpenAI key and model live in server env vars (OPENAI_API_KEY, OPENAI_MODEL).
 */
export const TUTOR = {
  /** Questions per user per Addis Ababa day. */
  dailyMessages: 30,
  /** Web searches per user per day. */
  dailySearches: 3,
  /** Max characters in one student message. */
  maxInputChars: 800,
  /** Only the last N chat messages are sent to the model. */
  historyMessages: 8,
  /** The current lesson part sent as context, ~1,500 tokens. */
  contextChars: 6000,
  /** Max tokens the model may write per answer. */
  maxOutputTokens: 500,
  /** Amharic needs ~3x more tokens per word, so Amharic answers get a bit more room. */
  maxOutputTokensAmharic: 800,
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
