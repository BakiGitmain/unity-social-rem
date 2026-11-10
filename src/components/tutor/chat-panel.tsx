"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Check, Copy, Globe, RotateCcw, Sparkles, Square, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-provider";
import { Markdown } from "@/components/tutor/markdown";
import { t, type SiteKey } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";
import {
  FOLLOWUPS_MARK,
  QUIZ_TOOL,
  TUTOR,
  type TutorIntent,
  type TutorMessageMeta,
  type TutorQuiz,
  type TutorView,
} from "@/lib/tutor/config";
import type { Side } from "@/components/tutor/bubble";
import type { TutorAsk } from "@/components/tutor/tutor";

type RemMessage = UIMessage<TutorMessageMeta>;
type AnyPart = RemMessage["parts"][number] & { state?: string; input?: unknown; url?: string; title?: string; sourceId?: string };

const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const;

/* ------------------------------------------------------------------ helpers */

/** Splits the trailing "FOLLOWUPS: a | b | c" line off an answer (also hides it while it is still streaming in). */
function splitFollowups(text: string): { body: string; followups: string[] } {
  const i = text.lastIndexOf(FOLLOWUPS_MARK);
  if (i >= 0) {
    return {
      body: text.slice(0, i).trim(),
      followups: text
        .slice(i + FOLLOWUPS_MARK.length)
        .split("|")
        .map((s) => s.trim())
        .filter((s) => s.length > 1)
        .slice(0, 3),
    };
  }
  const m = text.match(/\n\s*([A-Z]{1,9})$/);
  if (m && FOLLOWUPS_MARK.startsWith(m[1]!)) return { body: text.slice(0, m.index).trim(), followups: [] };
  return { body: text, followups: [] };
}

function textOf(m: RemMessage) {
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n\n");
}

function quizOf(m: RemMessage): { quiz: TutorQuiz | null; pending: boolean } {
  const p = m.parts.find((x) => x.type === `tool-${QUIZ_TOOL}`) as AnyPart | undefined;
  if (!p) return { quiz: null, pending: false };
  const q = p.input as Partial<TutorQuiz> | undefined;
  const ok =
    (p.state === "input-available" || p.state === "output-available") &&
    q &&
    typeof q.question === "string" &&
    Array.isArray(q.options) &&
    q.options.length >= 2 &&
    typeof q.answer === "number";
  if (!ok) return { quiz: null, pending: true };
  // The model sometimes adds **bold**; buttons show plain text.
  const plain = (x: string) => x.replace(/\*\*/g, "").trim();
  const quiz = q as TutorQuiz;
  return {
    quiz: { question: plain(quiz.question), options: quiz.options.map(plain), answer: quiz.answer, explanation: plain(quiz.explanation ?? "") },
    pending: false,
  };
}

/** Only what we need to show a chat again later (keeps the saved row small). */
function forStorage(messages: RemMessage[]): RemMessage[] {
  return messages.slice(-TUTOR.savedMessages).map((m) => ({
    id: m.id,
    role: m.role,
    metadata: undefined,
    parts: m.parts.filter((p) => {
      const t = (p as AnyPart).type;
      if (t === "text" || t === "source-url") return true;
      if (t === `tool-${QUIZ_TOOL}`) return (p as AnyPart).state === "output-available" || (p as AnyPart).state === "input-available";
      return t === "tool-web_search";
    }).map((p) => {
      const a = p as AnyPart;
      // Web search results can be large: keep only the marker.
      if (a.type === "tool-web_search") return { type: a.type, toolCallId: (a as { toolCallId?: string }).toolCallId ?? "ws", state: "output-available", input: {}, output: {} } as never;
      return p;
    }),
  }));
}

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesktop(mq.matches);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

/* ------------------------------------------------------------------ shell */

export default function ChatPanel(props: {
  open: boolean;
  onClose: () => void;
  side: Side;
  ask: TutorAsk | null;
  lessonId: string;
  lessonTitle: string;
  locale: Locale;
  view: TutorView;
  part: number;
}) {
  const { open, onClose, side, locale, lessonTitle } = props;
  const desktop = useIsDesktop();
  const drag = useDragControls();
  const chatRef = useRef<{ reset: () => void } | null>(null);
  const am = locale === "am" ? "am" : "";

  // Esc closes; lock page scroll behind the mobile sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    let prev = "";
    if (!desktop) {
      prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      if (!desktop) document.body.style.overflow = prev;
    };
  }, [open, onClose, desktop]);

  const onSheetDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  const header = (
    <div className="shrink-0 border-b border-line px-4 pt-2 pb-3">
      {!desktop && (
        <div
          className="mx-auto mb-2 flex h-5 w-full cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          onPointerDown={(e) => drag.start(e)}
          aria-hidden
        >
          <span className="h-1.5 w-10 rounded-full bg-line-strong" />
        </div>
      )}
      <div className={`flex items-center gap-2 ${desktop ? "pt-1.5" : ""}`}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white">
          <Sparkles className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p id="rem-title" className={`truncate text-[15px] font-semibold text-ink ${am}`}>
            {t(locale, "remName")} <span className="font-normal text-muted">· {t(locale, "studyTutor")}</span>
          </p>
          <p className={`mt-0.5 inline-block max-w-full truncate rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] font-medium text-accent-ink ${am}`}>
            {lessonTitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => chatRef.current?.reset()}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink ${am}`}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {t(locale, "newChat")}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t(locale, "closeChat")}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );

  const body = <ChatBody {...props} resetRef={chatRef} desktop={desktop} />;

  return (
    <AnimatePresence>
      {open &&
        (desktop ? (
          <motion.div
            key="panel"
            role="dialog"
            aria-labelledby="rem-title"
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8, transition: { duration: 0.16 } }}
            transition={spring}
            style={{ transformOrigin: side === "right" ? "bottom right" : "bottom left" }}
            className={`fixed bottom-6 z-50 flex h-[min(600px,calc(100dvh-7.5rem))] w-[400px] flex-col overflow-hidden rounded-3xl bg-surface shadow-[0_24px_60px_-24px_rgba(29,42,44,0.4)] ring-1 ring-line ${
              side === "right" ? "right-6" : "left-6"
            }`}
          >
            {header}
            {body}
          </motion.div>
        ) : (
          <motion.div key="sheet" className="fixed inset-0 z-50">
            <motion.div
              className="absolute inset-0 bg-ink/25"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-labelledby="rem-title"
              aria-modal="true"
              drag="y"
              dragControls={drag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={onSheetDragEnd}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%", transition: { type: "spring", stiffness: 420, damping: 40 } }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="absolute inset-x-0 bottom-0 flex h-[85dvh] flex-col overflow-hidden rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_-20px_rgba(29,42,44,0.35)]"
            >
              {header}
              {body}
            </motion.div>
          </motion.div>
        ))}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ chat */

function ChatBody({
  ask,
  lessonId,
  locale,
  view,
  part,
  resetRef,
  desktop,
  open,
}: {
  ask: TutorAsk | null;
  lessonId: string;
  locale: Locale;
  view: TutorView;
  part: number;
  resetRef: React.RefObject<{ reset: () => void } | null>;
  desktop: boolean;
  open: boolean;
}) {
  const { username, loading } = useUser();
  const pathname = usePathname();
  const am = locale === "am" ? "am" : "";
  const ui = (k: SiteKey, v?: Record<string, string | number>) => t(locale, k, v);

  if (loading) {
    return (
      <div className="grid flex-1 place-items-center" role="status">
        <span className="spinner" aria-hidden />
      </div>
    );
  }

  if (!username) {
    const next = encodeURIComponent((pathname || "/").replace(/^\/(en|am)(?=\/|$)/, "") || "/");
    return (
      <div className={`flex flex-1 flex-col items-center justify-center px-8 text-center ${am}`}>
        <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
          <Sparkles className="size-7" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-semibold text-ink">{ui("loginToAsk")}</p>
        <p className="mt-1.5 max-w-[30ch] text-sm leading-relaxed text-muted">{ui("loginToAskText")}</p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          <Link href={`/login?next=${next}`} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">
            {ui("login")}
          </Link>
          <Link href={`/signup?next=${next}`} className="rounded-full px-5 py-2.5 text-sm font-medium text-accent-ink ring-1 ring-line hover:bg-[var(--accent-tint)]">
            {ui("signup")}
          </Link>
        </div>
      </div>
    );
  }

  return <Chat ask={ask} lessonId={lessonId} locale={locale} view={view} part={part} resetRef={resetRef} desktop={desktop} open={open} />;
}

function Chat({
  ask,
  lessonId,
  locale,
  view,
  part,
  resetRef,
  desktop,
  open,
}: {
  ask: TutorAsk | null;
  lessonId: string;
  locale: Locale;
  view: TutorView;
  part: number;
  resetRef: React.RefObject<{ reset: () => void } | null>;
  desktop: boolean;
  open: boolean;
}) {
  const am = locale === "am" ? "am" : "";
  const ui = (k: SiteKey, v?: Record<string, string | number>) => t(locale, k, v);
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [limit, setLimit] = useState<number>(TUTOR.dailyMessages);
  const [resting, setResting] = useState(false);
  const [input, setInput] = useState("");
  const [tooFast, setTooFast] = useState(false);
  const handled = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const [transport] = useState(
    () =>
      new DefaultChatTransport<RemMessage>({
        api: "/api/tutor",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages: messages.slice(-TUTOR.historyMessages) },
        }),
      }),
  );

  const save = useCallback(
    async (messages: RemMessage[]) => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user.id;
        if (!uid) return;
        if (!messages.length) {
          await supabase.from("ai_chats").delete().eq("lesson_id", lessonId);
          return;
        }
        await supabase
          .from("ai_chats")
          .upsert({ user_id: uid, lesson_id: lessonId, messages: forStorage(messages), updated_at: new Date().toISOString() });
      } catch {
        /* saving history is best effort */
      }
    },
    [supabase, lessonId],
  );

  const { messages, sendMessage, status, stop, setMessages, error, clearError, regenerate } = useChat<RemMessage>({
    id: `rem-${lessonId}`,
    transport,
    onFinish: ({ messages: all, message, isAbort, isError }) => {
      const meta = message.metadata;
      if (typeof meta?.messagesLeft === "number") setLeft(meta.messagesLeft);
      if (meta?.resting) setResting(true);
      if (!isError) void save(all.filter((m) => !(isAbort && m.id === message.id && !textOf(m))));
    },
    onError: (e) => {
      if (/too_fast/.test(e.message)) setTooFast(true);
    },
  });

  // Load saved history + today's usage once.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [hist, usage] = await Promise.all([
          supabase.from("ai_chats").select("messages").eq("lesson_id", lessonId).maybeSingle(),
          supabase.rpc("my_ai_status"),
        ]);
        if (!alive) return;
        const saved = hist.data?.messages as RemMessage[] | undefined;
        if (Array.isArray(saved) && saved.length) setMessages(saved);
        const st = usage.data as { available?: boolean; messages?: number; limit?: number } | null;
        if (st) {
          const lim = st.limit ?? TUTOR.dailyMessages;
          setLimit(lim);
          setLeft(Math.max(0, lim - (st.messages ?? 0)));
          setResting(st.available === false);
        }
      } catch {
        /* start fresh */
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase, lessonId, setMessages]);

  const busy = status === "submitted" || status === "streaming";
  const limitReached = resting || (left !== null && left <= 0);

  const send = useCallback(
    (text: string, intent: TutorIntent = "chat", selectionContext?: string) => {
      const clean = text.trim().slice(0, TUTOR.maxInputChars);
      if (!clean || busy || limitReached) return;
      setTooFast(false);
      if (error) clearError();
      void sendMessage({ text: clean }, { body: { lessonId, view, part, locale, intent, selectionContext } });
    },
    [busy, limitReached, error, clearError, sendMessage, lessonId, view, part, locale],
  );

  // "New chat" from the header.
  useEffect(() => {
    resetRef.current = {
      reset: () => {
        void stop();
        clearError();
        setTooFast(false);
        setMessages([]);
        void save([]);
      },
    };
  }, [resetRef, stop, setMessages, save, clearError]);

  // A question from "Explain further" (or another trigger) is sent once history has loaded.
  useEffect(() => {
    if (!ready || !ask || handled.current === ask.id || busy) return;
    handled.current = ask.id;
    send(ask.text, ask.intent, ask.selectionContext);
  }, [ready, ask, busy, send]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: status === "streaming" ? "auto" : "smooth" });
  }, [messages, status]);

  // Focus the input when the panel opens on desktop (not on phones: no surprise keyboard).
  useEffect(() => {
    if (open && desktop) {
      const id = setTimeout(() => field.current?.focus(), 180);
      return () => clearTimeout(id);
    }
  }, [open, desktop]);

  // Auto-grow the textarea.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const submit = () => {
    if (!input.trim()) return;
    send(input);
    setInput("");
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const waiting =
    status === "submitted" ||
    (status === "streaming" && lastAssistant && messages[messages.length - 1]?.id === lastAssistant.id && !textOf(lastAssistant).trim() && !quizOf(lastAssistant).quiz);

  const suggestions: { key: SiteKey; intent?: TutorIntent }[] = [
    { key: "sugSimple" },
    { key: "sugExample" },
    { key: "sugQuiz", intent: "quiz" },
    { key: "sugAmharic" },
  ];

  return (
    <>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        {!ready ? (
          <div className="grid h-full place-items-center" role="status">
            <span className="spinner" aria-hidden />
          </div>
        ) : messages.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className={`pt-4 ${am}`}>
            <p className="text-xl font-semibold text-ink">{ui("tutorHello")}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{ui("tutorHelloText")}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <motion.button
                  key={s.key}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => send(ui(s.key), s.intent)}
                  disabled={limitReached}
                  className="rounded-full bg-[var(--accent-tint)] px-3.5 py-2 text-left text-sm font-medium text-accent-ink ring-1 ring-accent/20 transition-colors hover:bg-accent-soft disabled:opacity-50"
                >
                  {ui(s.key)}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <ol className="space-y-5">
            {messages.map((m, i) => {
              const isLast = m.id === lastAssistant?.id && i === messages.length - 1;
              return (
                <li key={m.id}>
                  {m.role === "user" ? (
                    <UserBubble text={textOf(m)} />
                  ) : (
                    <AssistantMessage
                      message={m}
                      question={i > 0 ? textOf(messages[i - 1]!) : ""}
                      lessonId={lessonId}
                      locale={locale}
                      isLast={isLast}
                      streaming={isLast && status === "streaming"}
                      canAct={!busy && !limitReached}
                      onSend={send}
                    />
                  )}
                </li>
              );
            })}
            {waiting && (
              <li>
                <TypingDots label={ui("remThinking")} />
              </li>
            )}
          </ol>
        )}

        {error && !busy && (
          <div className={`mt-4 rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad ${am}`} role="alert">
            {tooFast ? ui("tooFast") : ui("tutorError")}
            {!tooFast && (
              <button type="button" onClick={() => void regenerate({ body: { lessonId, view, part, locale } })} className="ml-2 font-semibold underline underline-offset-2">
                {ui("retry")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-line px-3 pt-3 pb-3">
        {limitReached ? (
          <div className={`rounded-2xl bg-[var(--accent-tint)] px-4 py-3 ${am}`}>
            <p className="font-semibold text-ink">{ui(resting ? "remResting" : "limitTitle")}</p>
            <p className="mt-0.5 text-sm text-muted">{resting ? ui("remRestingText") : ui("limitText", { n: limit })}</p>
          </div>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="flex items-end gap-2 rounded-3xl bg-paper px-2 py-1.5 ring-1 ring-line transition-shadow focus-within:ring-2 focus-within:ring-accent/40"
            >
              <textarea
                ref={field}
                rows={1}
                value={input}
                maxLength={TUTOR.maxInputChars}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={ui("askPlaceholder")}
                aria-label={ui("askPlaceholder")}
                className={`max-h-[140px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-snug text-ink outline-none placeholder:text-faint ${am}`}
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => void stop()}
                  aria-label={ui("stop")}
                  className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-ink text-white"
                >
                  <Square className="size-3.5 fill-current" aria-hidden />
                </button>
              ) : (
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.9 }}
                  disabled={!input.trim()}
                  aria-label={ui("send")}
                  className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white transition-opacity disabled:opacity-35"
                >
                  <ArrowUp className="size-[18px]" strokeWidth={2.4} aria-hidden />
                </motion.button>
              )}
            </form>
            <div className={`mt-1.5 flex items-center justify-between px-2 text-[11.5px] text-faint ${am}`}>
              <span>{left === null ? " " : left === 1 ? ui("questionLeft1") : ui("questionsLeft", { n: left })}</span>
              {input.length > TUTOR.maxInputChars - 200 && (
                <span className={`tabular-nums ${input.length >= TUTOR.maxInputChars ? "text-bad" : ""}`}>
                  {input.length}/{TUTOR.maxInputChars}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ messages */

function UserBubble({ text }: { text: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex justify-end">
      <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-[15px] leading-relaxed text-white [&_blockquote]:border-white/50 [&_blockquote]:text-white/85 [&_strong]:text-white">
        <Markdown text={text} />
      </div>
    </motion.div>
  );
}

function TypingDots({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2" role="status" aria-label={label}>
      <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-accent">
        <Sparkles className="size-3.5" aria-hidden />
      </span>
      <span className="flex gap-1 rounded-full bg-paper px-3 py-2.5 ring-1 ring-line">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-accent"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </span>
    </div>
  );
}

function AssistantMessage({
  message,
  question,
  lessonId,
  locale,
  isLast,
  streaming,
  canAct,
  onSend,
}: {
  message: RemMessage;
  question: string;
  lessonId: string;
  locale: Locale;
  isLast: boolean;
  streaming: boolean;
  canAct: boolean;
  onSend: (text: string, intent?: TutorIntent) => void;
}) {
  const ui = (k: SiteKey, v?: Record<string, string | number>) => t(locale, k, v);
  const am = locale === "am" ? "am" : "";
  const { body, followups } = splitFollowups(textOf(message));
  const { quiz } = quizOf(message);
  const parts = message.parts as AnyPart[];
  const searched = parts.some((p) => p.type === "tool-web_search");
  const sources = parts
    .filter((p) => p.type === "source-url" && p.url)
    .filter((p, i, a) => a.findIndex((x) => x.url === p.url) === i)
    .slice(0, 4);

  if (!body && !quiz) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex gap-2.5">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        <Sparkles className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {searched && <p className={`mb-1.5 text-xs font-medium text-muted ${am}`}>{ui("searchedWeb")}</p>}
        {body && (
          <div className="text-[15px] leading-relaxed text-ink/90">
            <Markdown text={body} />
            {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-full bg-accent/60 align-baseline" aria-hidden />}
          </div>
        )}
        {quiz && <QuizCard quiz={quiz} locale={locale} canAct={canAct && isLast} onAnother={() => onSend(ui("askAnotherQuiz"), "quiz")} />}

        {sources.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full bg-paper px-2.5 py-1 text-[11.5px] text-muted ring-1 ring-line hover:text-ink"
                >
                  <Globe className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{s.title || hostOf(s.url!)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {!streaming && body && (
          <Actions
            message={message}
            body={body}
            question={question}
            lessonId={lessonId}
            locale={locale}
            full={isLast}
            canAct={canAct}
            onSend={onSend}
          />
        )}

        {isLast && !streaming && followups.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {followups.map((f) => (
              <button
                key={f}
                type="button"
                disabled={!canAct}
                onClick={() => onSend(f)}
                className="rounded-full bg-[var(--accent-tint)] px-3 py-1.5 text-left text-[13px] font-medium text-accent-ink ring-1 ring-accent/20 transition-colors hover:bg-accent-soft disabled:opacity-50"
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Actions({
  message,
  body,
  question,
  lessonId,
  locale,
  full,
  canAct,
  onSend,
}: {
  message: RemMessage;
  body: string;
  question: string;
  lessonId: string;
  locale: Locale;
  full: boolean;
  canAct: boolean;
  onSend: (text: string, intent?: TutorIntent) => void;
}) {
  const ui = (k: SiteKey) => t(locale, k);
  const am = locale === "am" ? "am" : "";
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<1 | -1 | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const rate = async (rating: 1 | -1) => {
    setVote(rating);
    try {
      await createClient()
        .from("ai_feedback")
        .upsert(
          { message_id: message.id.slice(0, 100), rating, lesson_id: lessonId, question: question.slice(0, 2000), answer: body.slice(0, 8000) },
          { onConflict: "user_id,message_id" },
        );
    } catch {}
  };

  const chip =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-40";

  return (
    <div className={`mt-2 flex flex-wrap items-center gap-0.5 ${am}`}>
      <button type="button" onClick={copy} className={chip} aria-label={ui("copy")}>
        {copied ? <Check className="size-3.5 text-good" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        <span className="sr-only sm:not-sr-only">{copied ? ui("copied") : ui("copy")}</span>
      </button>
      {full && (
        <>
          <button type="button" disabled={!canAct} onClick={() => onSend(ui("askSimpler"))} className={chip}>
            {ui("simpler")}
          </button>
          <button type="button" disabled={!canAct} onClick={() => onSend(ui("askMoreDetail"))} className={chip}>
            {ui("moreDetail")}
          </button>
          <button type="button" disabled={!canAct} onClick={() => onSend(ui("askInAmharic"))} className={chip}>
            {ui("inAmharic")}
          </button>
        </>
      )}
      <span className="ml-auto flex items-center">
        <button
          type="button"
          onClick={() => rate(1)}
          aria-label={ui("helpful")}
          aria-pressed={vote === 1}
          className={`grid size-7 place-items-center rounded-full transition-colors hover:bg-ink/[0.05] ${vote === 1 ? "text-good" : "text-faint"}`}
        >
          <ThumbsUp className={`size-3.5 ${vote === 1 ? "fill-current" : ""}`} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => rate(-1)}
          aria-label={ui("notHelpful")}
          aria-pressed={vote === -1}
          className={`grid size-7 place-items-center rounded-full transition-colors hover:bg-ink/[0.05] ${vote === -1 ? "text-bad" : "text-faint"}`}
        >
          <ThumbsDown className={`size-3.5 ${vote === -1 ? "fill-current" : ""}`} aria-hidden />
        </button>
      </span>
    </div>
  );
}

function QuizCard({ quiz, locale, canAct, onAnother }: { quiz: TutorQuiz; locale: Locale; canAct: boolean; onAnother: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const ui = (k: SiteKey, v?: Record<string, string | number>) => t(locale, k, v);
  const am = locale === "am" ? "am" : "";
  const done = picked !== null;
  const right = picked === quiz.answer;
  const letters = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="rounded-2xl bg-paper p-4 ring-1 ring-line">
      <p className="text-[15px] leading-snug font-semibold text-ink">{quiz.question}</p>
      <div className="mt-3 grid gap-2">
        {quiz.options.map((o, i) => {
          const isAnswer = i === quiz.answer;
          const isPicked = i === picked;
          const tone = !done
            ? "bg-surface ring-line hover:ring-accent/50 hover:bg-[var(--accent-tint)]"
            : isAnswer
              ? "bg-good-soft ring-good/40 text-good"
              : isPicked
                ? "bg-bad-soft ring-bad/40 text-bad"
                : "bg-surface ring-line opacity-60";
          return (
            <motion.button
              key={i}
              type="button"
              disabled={done}
              whileTap={done ? undefined : { scale: 0.98 }}
              onClick={() => setPicked(i)}
              className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm ring-1 transition-colors ${tone}`}
            >
              <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-[11px] font-semibold">{letters[i]}</span>
              <span className="min-w-0">{o}</span>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={spring} className="overflow-hidden">
            <p className={`mt-3 text-sm font-semibold ${right ? "text-good" : "text-bad"} ${am}`}>
              {right ? ui("quizCorrect") : ui("quizWrong", { a: quiz.options[quiz.answer] ?? "" })}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink/80">{quiz.explanation}</p>
            {canAct && (
              <button
                type="button"
                onClick={onAnother}
                className={`mt-3 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white ${am}`}
              >
                {ui("anotherQuestion")}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
