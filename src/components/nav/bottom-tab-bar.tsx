"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, type PanInfo, type Transition } from "framer-motion";
import { CalendarDays, CircleUserRound, House, NotebookPen, type LucideIcon } from "lucide-react";
import { useDueCount } from "@/lib/notes/use-due";
import { useUser } from "@/components/user-provider";
import { useSiteSettings } from "@/components/site-settings";
import { AccountPanel } from "@/components/nav/account-panel";
import { useBarPinned } from "@/lib/bar-pin";
import { subjectStyle, SUBJECT_THEMES } from "@/lib/subjects";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";

const press = { type: "spring", stiffness: 700, damping: 22 } as const;
const glide = { type: "spring", stiffness: 520, damping: 38, mass: 0.8 } as const;
/** Multi-step bounce/pop. Springs only support two keyframes, so this is a short eased tween. */
const keyframePop: Transition = { duration: 0.42, times: [0, 0.4, 0.75, 1], ease: "easeOut" };
const sheetSpring = { type: "spring", stiffness: 500, damping: 34, mass: 0.8 } as const;

/**
 * Mobile: a floating, frosted-glass pill tab bar.
 * The active tab gets a sliding subject-coloured pill, a filled icon and its label; inactive tabs are icon-only.
 * It hides while scrolling down and comes back when scrolling up or at the end of the page.
 * To add a tab later, add an entry to `tabs` below.
 */
export function BottomTabBar({ locale }: { locale: Locale }) {
  const pathname = (usePathname() || "/").replace(/^\/(en|am)(?=\/|$)/, "") || "/";
  const [sheet, setSheet] = useState(false);
  const { username } = useUser();
  const { settings } = useSiteSettings();
  const hidden = useHideOnScroll(sheet);

  // Tint the bar with the colour of the subject being studied.
  const subject = pathname.split("/")[1];
  const themed = subject && SUBJECT_THEMES[subject] ? subjectStyle(subject) : undefined;

  const onAuthPage = /^\/(login|signup)/.test(pathname);
  // A notes board has its own bottom toolbar.
  const onBoard = /^\/notes\/(?!review)[^/]+/.test(pathname);
  const active = sheet || onAuthPage ? "profile" : pathname.startsWith("/schedule") ? "schedule" : pathname.startsWith("/notes") ? "notes" : "home";
  const due = useDueCount();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSheet(false);
  }, [pathname]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  const allTabs: TabDef[] = [
    { id: "home", href: "/", label: t(locale, "home"), am: locale === "am", icon: { kind: "lucide", Icon: House, bounce: true } },
    { id: "schedule", href: "/schedule", label: t(locale, "schedule"), am: locale === "am", icon: { kind: "lucide", Icon: CalendarDays, bounce: true } },
    { id: "notes", href: "/notes", label: t(locale, "notes"), am: locale === "am", badge: due, icon: { kind: "lucide", Icon: NotebookPen, bounce: true } },
    {
      id: "profile",
      label: username ? `@${username}` : t(locale, "login"),
      am: locale === "am" && !username,
      onClick: () => setSheet(true),
      icon: username ? { kind: "avatar", letter: username[0]!.toUpperCase() } : { kind: "lucide", Icon: CircleUserRound },
    },
  ];
  const tabs = allTabs.filter((tab) => tab.id !== "schedule" || settings.features.schedule);

  return (
    <>
      <motion.nav
        aria-label="Main"
        style={themed}
        className="pointer-events-none fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:hidden"
        initial={false}
        animate={{ y: hidden || onBoard ? 130 : 0, opacity: hidden || onBoard ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
      >
        <div className="pointer-events-auto flex max-w-full min-w-0 items-center gap-1 rounded-full bg-white/80 p-1.5 shadow-[0_10px_30px_-10px_rgba(29,42,44,0.28),0_1px_2px_rgba(29,42,44,0.06)] ring-1 ring-black/[0.06] backdrop-blur-xl backdrop-saturate-150">
          {tabs.map((tab) => (
            <Tab key={tab.id} tab={tab} active={active === tab.id} />
          ))}
        </div>
      </motion.nav>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-ink/30 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSheet(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t(locale, "account")}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-surface px-4 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-16px_rgba(29,42,44,0.3)] md:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={sheetSpring}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_: unknown, info: PanInfo) => {
                if (info.offset.y > 90 || info.velocity.y > 500) setSheet(false);
              }}
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong" aria-hidden />
              <p className={`px-3 pb-2 text-lg font-semibold text-ink ${locale === "am" ? "am" : ""}`}>{t(locale, "account")}</p>
              <AccountPanel locale={locale} onDone={() => setSheet(false)} size="lg" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------------- tabs ---------------- */

type TabIcon = { kind: "lucide"; Icon: LucideIcon; bounce?: boolean } | { kind: "avatar"; letter: string };
type TabDef = { id: string; label: string; am: boolean; icon: TabIcon; href?: string; onClick?: () => void; badge?: number };

function Tab({ tab, active }: { tab: TabDef; active: boolean }) {
  const content = (
    <motion.span
      whileTap={{ scale: 0.9 }}
      transition={press}
      className="relative flex h-12 min-w-12 items-center justify-center gap-2 rounded-full px-3"
    >
      {active && (
        <motion.span layoutId="tabbar-pill" className="absolute inset-0 rounded-full bg-accent-soft" transition={glide} />
      )}
      <TabGlyph icon={tab.icon} active={active} />
      {!!tab.badge && (
        <span className="absolute top-1 right-1 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] leading-[18px] font-semibold text-white tabular-nums ring-2 ring-white" aria-hidden>
          {tab.badge > 99 ? "99+" : tab.badge}
        </span>
      )}
      <AnimatePresence initial={false}>
        {active && (
          <motion.span
            key="label"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={glide}
            className="relative overflow-hidden"
          >
            <span className={`block max-w-[min(9.5rem,24vw)] truncate pr-1 text-sm font-semibold whitespace-nowrap text-accent-ink ${tab.am ? "am leading-normal" : ""}`}>
              {tab.label}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );

  const common = {
    "aria-label": tab.badge ? `${tab.label} (${tab.badge})` : tab.label,
    className: "rounded-full outline-offset-2 [-webkit-tap-highlight-color:transparent]",
  };
  return tab.href ? (
    <Link href={tab.href} aria-current={active ? "page" : undefined} {...common}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={tab.onClick} aria-haspopup="dialog" aria-expanded={active} {...common}>
      {content}
    </button>
  );
}

function TabGlyph({ icon, active }: { icon: TabIcon; active: boolean }) {
  if (icon.kind === "avatar") {
    return (
      <motion.span
        className={`relative grid size-7 place-items-center rounded-full text-[13px] font-semibold transition-colors duration-300 ${
          active ? "bg-accent text-white" : "bg-accent-soft text-accent-ink"
        }`}
        animate={active ? { scale: [1, 1.18, 0.96, 1] } : { scale: 1 }}
        transition={keyframePop}
        aria-hidden
      >
        {icon.letter}
      </motion.span>
    );
  }
  const { Icon, bounce } = icon;
  return (
    <motion.span
      className="relative grid"
      animate={active && bounce ? { y: [0, -4, 0.5, 0] } : active ? { scale: [1, 1.12, 0.97, 1] } : { y: 0, scale: 1 }}
      transition={keyframePop}
      aria-hidden
    >
      <Icon
        className={`size-[22px] transition-[color,fill-opacity,stroke-width] duration-300 ${active ? "text-accent-ink" : "text-muted"}`}
        fill="currentColor"
        fillOpacity={active ? 0.22 : 0}
        strokeWidth={active ? 2.2 : 1.8}
      />
    </motion.span>
  );
}

/* ---------------- hide on scroll ---------------- */

/** Hidden while scrolling down; shown when scrolling up, near the top or at the end of the page, or when pinned. */
function useHideOnScroll(forceShow: boolean) {
  const pinned = useBarPinned();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY.current;
        const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 24;
        if (y < 80 || atEnd || dy < -6) setHidden(false);
        else if (dy > 6) setHidden(true);
        if (Math.abs(dy) > 6) lastY.current = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return hidden && !pinned && !forceShow;
}
