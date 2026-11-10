"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Command,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_IDLE_MS } from "@/lib/admin/access";
import { paletteData, toggleAiTutor } from "@/lib/admin/actions/misc";
import { useToast } from "@/components/admin/toast";
import { LiveProvider, useLiveStatus } from "@/components/live";
import { NowProvider, timeAgo, useNowMs, useStartedAt } from "@/components/admin/ui";

export const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/content", label: "Content", icon: BookOpen },
  { href: "/admin/quizzes", label: "Quiz analytics", icon: Target },
  { href: "/admin/ai", label: "AI tutor", icon: Sparkles },
  { href: "/admin/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/settings", label: "Site settings", icon: Settings },
  { href: "/admin/system", label: "System", icon: Activity },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

const isActive = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/"));

/* ---------------- breadcrumbs: pages can name their last crumb (e.g. "@abel") ---------------- */

const CrumbCtx = createContext<(label: string | null) => void>(() => {});

/** Put this in a page to label the last breadcrumb (e.g. a username or lesson title). */
export function SetCrumb({ label }: { label: string }) {
  const set = useContext(CrumbCtx);
  useEffect(() => {
    set(label);
    return () => set(null);
  }, [label, set]);
  return null;
}

function Breadcrumbs({ last }: { last: string | null }) {
  const pathname = usePathname() || "/admin";
  const parts = pathname.split("/").filter(Boolean); // ["admin", "users", "<id>"]
  const crumbs: { href: string; label: string }[] = [{ href: "/admin", label: "Admin" }];
  for (let i = 1; i < parts.length; i++) {
    const href = "/" + parts.slice(0, i + 1).join("/");
    const nav = NAV.find((n) => n.href === href);
    const isLast = i === parts.length - 1;
    const label = nav?.label ?? (isLast && last ? last : parts[i]!.length > 20 ? "Details" : parts[i]!.replace(/-/g, " "));
    crumbs.push({ href, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden />}
            {i === crumbs.length - 1 ? (
              <span className="truncate font-medium text-ink" aria-current="page">
                {c.label}
              </span>
            ) : (
              <Link href={c.href} className="truncate text-muted hover:text-ink">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ---------------- shell ---------------- */

export function AdminShell({ username, children }: { username: string; children: React.ReactNode }) {
  const pathname = usePathname() || "/admin";
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [crumb, setCrumb] = useState<string | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem("usr-admin-sidebar") === "1");
    } catch {}
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem("usr-admin-sidebar", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const navList = (compact: boolean) => (
    <ul className="space-y-0.5">
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              title={compact ? n.label : undefined}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                active ? "text-accent-ink" : "text-muted hover:bg-ink/[0.04] hover:text-ink"
              } ${compact ? "justify-center px-0" : ""}`}
            >
              {active && <motion.span layoutId={compact ? "nav-pill-c" : "nav-pill"} className="absolute inset-0 rounded-xl bg-accent-soft" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <n.icon className="relative size-[18px] shrink-0" aria-hidden />
              {!compact && <span className="relative truncate">{n.label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <LiveProvider>
    <NowProvider>
    <CrumbCtx value={setCrumb}>
      <IdleLogout />
      <div className="flex min-h-dvh">
        {/* desktop sidebar */}
        <motion.aside
          animate={{ width: collapsed ? 76 : 248 }}
          transition={{ type: "spring", stiffness: 400, damping: 38 }}
          className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface/70 px-3 py-4 lg:flex"
        >
          <div className={`flex items-center gap-2.5 px-2 pb-5 ${collapsed ? "justify-center px-0" : ""}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-white">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">Admin</span>
                <span className="block truncate text-xs text-muted">@{username}</span>
              </span>
            )}
          </div>
          <nav aria-label="Admin" className="min-h-0 flex-1 overflow-y-auto">
            {navList(collapsed)}
          </nav>
          <div className="space-y-0.5 border-t border-line pt-3">
            <Link href="/" className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-ink/[0.04] hover:text-ink ${collapsed ? "justify-center px-0" : ""}`} title="Back to site">
              <ExternalLink className="size-[18px]" aria-hidden />
              {!collapsed && "Back to site"}
            </Link>
            <button
              type="button"
              onClick={toggleCollapsed}
              className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-ink/[0.04] hover:text-ink ${collapsed ? "justify-center px-0" : ""}`}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
              {!collapsed && "Collapse"}
            </button>
          </div>
        </motion.aside>

        {/* mobile drawer */}
        <AnimatePresence>
          {drawer && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <motion.div className="absolute inset-0 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} aria-hidden />
              <motion.aside
                role="dialog"
                aria-label="Admin menu"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface px-3 py-4"
              >
                <div className="flex items-center justify-between px-2 pb-4">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <ShieldCheck className="size-5 text-accent" aria-hidden /> Admin · @{username}
                  </span>
                  <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="grid size-9 place-items-center rounded-full hover:bg-ink/[0.05]">
                    <X className="size-5" aria-hidden />
                  </button>
                </div>
                <nav aria-label="Admin" className="min-h-0 flex-1 overflow-y-auto">
                  {navList(false)}
                </nav>
                <Link href="/" className="mt-2 flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-ink/[0.04]">
                  <ExternalLink className="size-[18px]" aria-hidden /> Back to site
                </Link>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/85 px-4 backdrop-blur-md sm:px-6">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" className="-ml-2 grid size-10 place-items-center rounded-full hover:bg-ink/[0.05] lg:hidden">
              <Menu className="size-5" aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              <Breadcrumbs last={crumb} />
            </div>
            <LiveIndicator />
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="flex h-9 items-center gap-2 rounded-full bg-surface px-3 text-sm text-muted ring-1 ring-line hover:text-ink"
              aria-label="Open command palette"
            >
              <Search className="size-4" aria-hidden />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden items-center gap-0.5 rounded-md bg-ink/[0.05] px-1.5 py-0.5 text-[11px] font-medium sm:inline-flex">
                <Command className="size-3" aria-hidden />K
              </kbd>
            </button>
            <SignOut />
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </CrumbCtx>
    </NowProvider>
    </LiveProvider>
  );
}

/** "● Live · Updated just now": the page refreshes itself (Realtime and/or every 60 s while the tab is visible). */
function LiveIndicator() {
  const { lastUpdated, connected } = useLiveStatus();
  const now = useNowMs();
  const startedAt = useStartedAt();
  const shown = lastUpdated ?? startedAt;
  const ago = !shown || now === null ? "" : now - shown < 45_000 ? "just now" : timeAgo(new Date(shown).toISOString(), now);
  return (
    <span
      className="hidden items-center gap-1.5 text-xs text-muted sm:inline-flex"
      title={connected ? "Realtime connected. Also refreshes every 60 s while this tab is open." : "Refreshes every 60 s while this tab is open."}
    >
      <span className="relative flex size-2" aria-hidden>
        {connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-good/60" />}
        <span className="relative inline-flex size-2 rounded-full bg-good" />
      </span>
      <span>
        Live{ago && <span className="text-faint"> · Updated {ago}</span>}
      </span>
    </span>
  );
}

function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/");
      }}
      aria-label="Sign out"
      title="Sign out"
      className="grid size-9 place-items-center rounded-full text-muted hover:bg-ink/[0.05] hover:text-ink"
    >
      <LogOut className="size-4" aria-hidden />
    </button>
  );
}

/** Signs the admin out after 30 minutes without activity (the proxy also enforces this on the server). */
function IdleLogout() {
  const router = useRouter();
  const last = useRef(0);
  const [warn, setWarn] = useState(false);

  useEffect(() => {
    last.current = Date.now();
    const bump = () => {
      last.current = Date.now();
      setWarn(false);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(async () => {
      const idle = Date.now() - last.current;
      if (idle > ADMIN_IDLE_MS) {
        clearInterval(timer);
        await createClient().auth.signOut();
        router.replace("/login?next=/admin");
      } else if (idle > ADMIN_IDLE_MS - 2 * 60 * 1000) setWarn(true);
    }, 15_000);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [router]);

  return (
    <AnimatePresence>
      {warn && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-2 z-[95] mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg"
          role="alert"
        >
          You&apos;ll be signed out in 2 minutes for safety. Move the mouse to stay.
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- command palette ---------------- */

type Item = { id: string; label: string; hint: string; icon: LucideIcon; run: () => void | Promise<void> };

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [data, setData] = useState<{ users: { id: string; username: string }[]; lessons: { id: string; code: string; title: string }[]; aiOn: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQ("");
    setIdx(0);
    setTimeout(() => input.current?.focus(), 30);
    void paletteData().then((r) => r.ok && setData(r.data));
  }, [open]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const items = useMemo<Item[]>(() => {
    const pages: Item[] = NAV.map((n) => ({ id: n.href, label: n.label, hint: "Page", icon: n.icon, run: () => go(n.href) }));
    const actions: Item[] = [
      { id: "a-ann", label: "New announcement", hint: "Action", icon: Megaphone, run: () => go("/admin/announcements?new=1") },
      { id: "a-maint", label: "Maintenance mode…", hint: "Action", icon: Settings, run: () => go("/admin/settings#maintenance") },
      {
        id: "a-ai",
        label: data?.aiOn === false ? "Turn the AI tutor ON" : "Turn the AI tutor OFF",
        hint: "Action",
        icon: Sparkles,
        run: async () => {
          const on = data?.aiOn === false;
          if (!window.confirm(on ? "Turn Rem back on for everyone?" : "Turn Rem off for everyone?")) return;
          const r = await toggleAiTutor(on);
          onClose();
          if (r.ok) toast({ title: on ? "AI tutor is ON" : "AI tutor is OFF" });
          else toast({ title: "Could not change it", text: r.error, tone: "error" });
        },
      },
    ];
    const users: Item[] = (data?.users ?? []).map((u) => ({ id: "u" + u.id, label: `@${u.username}`, hint: "User", icon: Users, run: () => go(`/admin/users/${u.id}`) }));
    const lessons: Item[] = (data?.lessons ?? []).map((l) => ({ id: "l" + l.id, label: `${l.code} ${l.title}`, hint: "Lesson", icon: BookOpen, run: () => go(`/admin/content/lessons/${l.id}`) }));
    const all = [...pages, ...actions, ...users, ...lessons];
    const needle = q.trim().toLowerCase();
    if (!needle) return [...pages, ...actions];
    return all.filter((i) => i.label.toLowerCase().includes(needle)).slice(0, 30);
  }, [data, q, go, onClose, toast]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        void items[idx]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, idx, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[96] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 480, damping: 36 }}
            className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-surface shadow-[0_30px_70px_-24px_rgba(29,42,44,0.5)] ring-1 ring-line"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-5 text-faint" aria-hidden />
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIdx(0);
                }}
                placeholder="Jump to a page, user or lesson…"
                className="h-14 flex-1 bg-transparent text-[15px] text-ink placeholder:text-faint"
                aria-label="Search"
              />
              <kbd className="rounded-md bg-ink/[0.05] px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
              {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No results</li>}
              {items.map((it, i) => (
                <li key={it.id} role="option" aria-selected={i === idx}>
                  <button
                    type="button"
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => void it.run()}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${i === idx ? "bg-accent-soft text-accent-ink" : "text-ink"}`}
                  >
                    <it.icon className="size-4 shrink-0 opacity-70" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    <span className="text-xs text-faint">{it.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
