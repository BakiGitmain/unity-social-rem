import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";
import type { DayClass } from "@/lib/time/overrides";

const STYLE = {
  cancelled: "bg-bad-soft text-bad",
  room_changed: "bg-tip-soft text-tip",
  extra: "bg-good-soft text-good",
  exam: "bg-note-soft text-note",
} as const;

const LABEL = { cancelled: "cancelled", room_changed: "roomChanged", extra: "extraClass", exam: "examLabel" } as const;

/** "Cancelled" / "Room changed" / "Extra class" / "Exam" (from Admin → Schedule date overrides). */
export function StatusBadge({ entry, locale }: { entry: DayClass; locale: Locale }) {
  if (!entry.status) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-normal normal-case ${STYLE[entry.status]}`}>
      {t(locale, LABEL[entry.status])}
    </span>
  );
}
