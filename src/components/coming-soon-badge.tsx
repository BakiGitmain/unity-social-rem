import { Clock } from "lucide-react";
import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";

/** Small badge for items an admin marked "Coming soon" (visible, but not openable yet). */
export function ComingSoonBadge({ locale, className = "" }: { locale: Locale; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-faint ring-1 ring-line ${
        locale === "am" ? "am" : ""
      } ${className}`}
    >
      <Clock className="size-3" aria-hidden />
      {t(locale, "comingSoon")}
    </span>
  );
}

export const SOON_LINK = "pointer-events-none opacity-60";
