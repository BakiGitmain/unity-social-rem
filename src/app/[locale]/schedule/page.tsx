import type { Metadata } from "next";
import { getSchedule } from "@/lib/data";
import { isLocale, loc, type Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";
import { ScheduleView } from "@/components/schedule/schedule-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/schedule">): Promise<Metadata> {
  const { locale } = await params;
  return { title: t(isLocale(locale) ? locale : "en", "schedule") };
}

export default async function SchedulePage({ params }: PageProps<"/[locale]/schedule">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "en";
  const data = await getSchedule();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      {data ? (
        <ScheduleView
          entries={data.entries}
          locale={locale}
          sectionName={`${loc(data.section, "name", locale)} · ${loc(data.section, "school", locale)}${data.section.year_ec ? ` · ${data.section.year_ec} ${locale === "am" ? "ዓ.ም" : "E.C."}` : ""}`}
        />
      ) : (
        <p className="text-muted">{t(locale, "comingSoon")}</p>
      )}
    </div>
  );
}
