"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type PanInfo } from "framer-motion";
import { Sparkles } from "lucide-react";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";

const SIZE = 56;
const EDGE = 16;
const POS_KEY = "usr-rem-pos";
const TIP_KEY = "usr-rem-tip-seen";
const IDLE_MS = 10_000;
/** Apple-style snap: quick, a touch of bounce. */
const snap = { type: "spring", stiffness: 420, damping: 32, mass: 0.9 } as const;

export type Side = "left" | "right";

export type BubbleHandle = { focus: () => void };

/** Height of the notes button stacked above Rem (it moves together with Rem). */
const STACK = 54;
/**
 * Safe area for the bubble: below the header (with room for the notes button above Rem), above the mobile tab
 * bar, inside the VISIBLE viewport (phone URL bar / keyboard). Never off-screen, even on very short screens.
 */
function bounds() {
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  const mobile = w < 768;
  const lowest = h - SIZE - 8; // the bubble's top can never be lower than this
  const minY = Math.min((mobile ? 72 : 88) + STACK, Math.max(STACK + 8, lowest));
  const maxY = Math.max(minY, Math.min(lowest, h - SIZE - (mobile ? 104 : 24)));
  return { minX: EDGE, maxX: Math.max(EDGE, w - SIZE - EDGE), minY, maxY };
}

function readPos(): { side: Side; y: number } {
  try {
    const v = JSON.parse(window.localStorage.getItem(POS_KEY) ?? "null");
    if (v && (v.side === "left" || v.side === "right") && typeof v.y === "number") return { side: v.side, y: Math.min(1, Math.max(0, v.y)) };
  } catch {}
  return { side: "right", y: 1 };
}

function savePos(side: Side, y: number) {
  try {
    window.localStorage.setItem(POS_KEY, JSON.stringify({ side, y }));
  } catch {}
}

/**
 * The floating "Ask Rem" button. Drag it anywhere; on release it springs to the nearest left/right edge.
 * Fades to 30% after 10 s without interaction, wakes on hover, touch, focus, or when scrolling stops.
 */
export const Bubble = forwardRef<
  BubbleHandle,
  {
    hidden: boolean;
    locale: Locale;
    onOpen: () => void;
    onSide: (s: Side) => void;
    onWarmUp: () => void;
    /** Shown just above Rem and dragged together with it (the 📝 notes button). */
    extra?: React.ReactNode;
    /** Hide Rem itself (AI tutor switched off) but keep `extra`. */
    remHidden?: boolean;
  }
>(function Bubble({ hidden, locale, onOpen, onSide, onWarmUp, extra, remHidden = false }, ref) {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const [ready, setReady] = useState(false);
  /** Drag limits (kept in sync with the screen size): the bubble can't be dragged off-screen. */
  const [box, setBox] = useState({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  const [side, setSide] = useState<Side>("right");
  const [dim, setDim] = useState(false);
  const [tip, setTip] = useState(false);
  const [glow, setGlow] = useState(true);
  const dragged = useRef(false);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const btn = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  useImperativeHandle(ref, () => ({ focus: () => btn.current?.focus() }), []);

  const wake = useCallback(() => {
    setDim(false);
    clearTimeout(idle.current);
    idle.current = setTimeout(() => setDim(true), IDLE_MS);
  }, []);

  const place = useCallback(
    (s: Side, frac: number, smooth: boolean) => {
      const b = bounds();
      setBox(b);
      const tx = s === "left" ? b.minX : b.maxX;
      const ty = b.minY + frac * Math.max(0, b.maxY - b.minY);
      if (smooth && !reduce) {
        animate(x, tx, snap);
        animate(y, ty, snap);
      } else {
        x.set(tx);
        y.set(ty);
      }
      setSide(s);
      onSide(s);
    },
    [x, y, reduce, onSide],
  );

  // Initial position (client only) + keep it on screen when the window resizes.
  useEffect(() => {
    const p = readPos();
    place(p.side, p.y, false);
    setReady(true);
    const onResize = () => place(readPos().side, readPos().y, false);
    const vv = window.visualViewport;
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    vv?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      vv?.removeEventListener("resize", onResize);
    };
  }, [place]);

  // Fade when idle; wake when scrolling stops or the pointer comes near.
  useEffect(() => {
    wake();
    let scrollStop: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    const onScroll = () => {
      clearTimeout(scrollStop);
      scrollStop = setTimeout(wake, 350);
    };
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const dx = e.clientX - (x.get() + SIZE / 2);
        const dy = e.clientY - (y.get() + SIZE / 2);
        if (dx * dx + dy * dy < 140 * 140) wake();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      clearTimeout(idle.current);
      clearTimeout(scrollStop);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
    };
  }, [wake, x, y]);

  // One-time tooltip, and the soft glow only on first appearance.
  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(TIP_KEY) === "1";
    } catch {}
    const g = setTimeout(() => setGlow(false), 3600);
    if (seen) return () => clearTimeout(g);
    const show = setTimeout(() => setTip(true), 1200);
    const hide = setTimeout(() => dismissTip(), 8000);
    return () => [g, show, hide].forEach(clearTimeout);
  }, []);

  function dismissTip() {
    setTip(false);
    try {
      window.localStorage.setItem(TIP_KEY, "1");
    } catch {}
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const b = bounds();
    // Throwing it sideways picks that edge; otherwise the nearest one.
    const projected = x.get() + SIZE / 2 + info.velocity.x * 0.12;
    const s: Side = projected < (b.minX + b.maxX + SIZE) / 2 ? "left" : "right";
    const ty = Math.min(b.maxY, Math.max(b.minY, y.get() + info.velocity.y * 0.05));
    const frac = b.maxY > b.minY ? (ty - b.minY) / (b.maxY - b.minY) : 1;
    place(s, frac, true);
    savePos(s, frac);
    wake();
  };

  if (!ready) return null;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          key="rem-bubble"
          className="fixed top-0 left-0 z-40 touch-none select-none"
          style={{ x, y }}
          drag
          dragMomentum={false}
          dragElastic={0}
          dragConstraints={{ left: box.minX, right: box.maxX, top: box.minY, bottom: box.maxY }}
          onDragStart={() => {
            dragged.current = true;
            dismissTip();
          }}
          onDragEnd={onDragEnd}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: dim ? 0.3 : 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.16 } }}
          transition={{ type: "spring", stiffness: 380, damping: 28, opacity: { duration: 0.6 } }}
          onPointerEnter={wake}
          onPointerDown={() => {
            dragged.current = false;
            wake();
            onWarmUp();
          }}
        >
          {extra && <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2">{extra}</div>}
          {/* Tooltip, on the side facing the page */}
          <AnimatePresence>
            {tip && !remHidden && (
              <motion.button
                type="button"
                onClick={dismissTip}
                initial={{ opacity: 0, scale: 0.9, x: side === "right" ? 8 : -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={snap}
                className={`absolute top-1/2 w-max max-w-[220px] -translate-y-1/2 rounded-2xl bg-ink px-3 py-2 text-left text-[13px] leading-snug font-medium text-white shadow-[0_8px_24px_-10px_rgba(29,42,44,0.45)] ${
                  side === "right" ? "right-[calc(100%+10px)]" : "left-[calc(100%+10px)]"
                } ${locale === "am" ? "am" : ""}`}
              >
                {t(locale, "tutorTip")}
              </motion.button>
            )}
          </AnimatePresence>

          <motion.button
            ref={btn}
            type="button"
            hidden={remHidden}
            aria-label={t(locale, "askRem")}
            onClick={() => {
              if (dragged.current) return; // a drag is not a tap
              dismissTip();
              onOpen();
            }}
            onFocus={wake}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            transition={snap}
            className="relative grid place-items-center rounded-full bg-accent text-white shadow-[0_10px_26px_-10px_rgba(29,42,44,0.5)] ring-4 ring-white/70 outline-none focus-visible:ring-accent/40"
            style={{ width: SIZE, height: SIZE }}
          >
            {glow && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full bg-accent"
                initial={{ opacity: 0.45, scale: 1 }}
                animate={{ opacity: 0, scale: 1.9 }}
                transition={{ duration: 1.6, repeat: 1, ease: "easeOut" }}
              />
            )}
            <motion.span
              aria-hidden
              className="grid"
              animate={{ rotate: [0, 14, -8, 0], scale: [1, 1.12, 1, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 5, ease: "easeInOut" }}
            >
              <Sparkles className="size-6" strokeWidth={2} />
            </motion.span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
