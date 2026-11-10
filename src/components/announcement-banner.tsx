"use client";

import { useCallback, useEffect, useState } from "react";
import { usePolling, useRealtime } from "@/components/live";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Siren, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/user-provider";
import type { Locale } from "@/lib/locale";

export type Announcement = {
  id: string;
  title_en: string;
  title_am: string;
  message_en: string;
  message_am: string;
  type: "info" | "success" | "warning" | "urgent";
  link_url: string | null;
  audience?: "everyone" | "logged_in";
  updated_at?: string;
};

const DISMISS_KEY = "usr-dismissed-announcements";

export const ANNOUNCEMENT_STYLES = {
  info: { box: "bg-note-soft text-note ring-note/20", Icon: Info },
  success: { box: "bg-good-soft text-good ring-good/20", Icon: CheckCircle2 },
  warning: { box: "bg-tip-soft text-tip ring-tip/25", Icon: AlertTriangle },
  urgent: { box: "bg-bad-soft text-bad ring-bad/25", Icon: Siren },
} as const;

function readDismissed(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(DISMISS_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** One banner (also used as the live preview in Admin → Announcements). */
export function AnnouncementCard({
  a,
  locale,
  onDismiss,
}: {
  a: Announcement;
  locale: Locale;
  onDismiss?: () => void;
}) {
  const s = ANNOUNCEMENT_STYLES[a.type] ?? ANNOUNCEMENT_STYLES.info;
  const am = locale === "am" && (a.title_am || a.message_am);
  const title = am ? a.title_am || a.title_en : a.title_en;
  const message = am ? a.message_am || a.message_en : a.message_en;
  return (
    <div role={a.type === "urgent" ? "alert" : "status"} className={`flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 ${s.box}`}>
      <s.Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className={`min-w-0 flex-1 text-sm ${am ? "am" : ""}`}>
        <p className="font-semibold">{title}</p>
        {message && <p className="mt-0.5 text-ink/80">{message}</p>}
        {a.link_url && (
          <a href={a.link_url} className="mt-1 inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
            {locale === "am" ? "ተጨማሪ" : "Learn more"}
            <ArrowRight className="size-3.5" aria-hidden />
          </a>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={locale === "am" ? "ዝጋ" : "Dismiss"}
          className="-m-1 grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-black/5"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Site-wide banners. Live window + audience are enforced by RLS; dismissals are remembered in this browser. */
export function AnnouncementBanner({ locale }: { locale: Locale }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const { username, loading } = useUser();

  const load = useCallback(() => {
    void createClient()
      .from("announcements")
      .select("id, title_en, title_am, message_en, message_am, type, link_url, updated_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setItems((data as Announcement[] | null) ?? []));
  }, []);

  useEffect(() => {
    if (loading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed());
    load();
  }, [loading, username, load]);

  // Published / edited / removed announcements appear and disappear live. Start/end times are checked by
  // RLS on each load, so a light 60 s poll catches announcements that start or end while the page is open.
  useRealtime("announcements", [{ table: "announcements" }], load, { enabled: !loading, onResume: load });
  usePolling(load, 60_000, !loading);

  // An edited announcement shows again (the key includes its update time).
  const keyOf = (a: Announcement) => `${a.id}:${a.updated_at ?? ""}`;
  const visible = items.filter((a) => !dismissed.includes(keyOf(a)));

  const dismiss = (a: Announcement) => {
    const next = [...dismissed, keyOf(a)].slice(-50);
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {}
  };

  return (
    <AnimatePresence initial={false}>
      {visible.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="overflow-hidden"
        >
          <div className="mx-auto grid max-w-6xl gap-2 px-4 pt-3 sm:px-6">
            <AnimatePresence initial={false}>
              {visible.map((a) => (
                <motion.div
                  key={a.id}
                  layout
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                >
                  <AnnouncementCard a={a} locale={locale} onDismiss={() => dismiss(a)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
