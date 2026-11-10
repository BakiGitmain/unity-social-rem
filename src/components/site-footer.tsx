import { t } from "@/lib/site-i18n";
import type { Locale } from "@/lib/locale";

export function SiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-faint sm:px-6">
        <p className={locale === "am" ? "am" : ""}>{t(locale, "footer")}</p>
      </div>
    </footer>
  );
}
