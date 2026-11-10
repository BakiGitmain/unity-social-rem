import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSchedule, getSubjects } from "@/lib/data";
import { TodayCard } from "@/components/schedule/today-card";
import { ScheduleLive } from "@/components/schedule/schedule-live";
import { subjectStyle } from "@/lib/subjects";
import { isLocale, loc, type Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";
import { Stagger, StaggerItem } from "@/components/motion";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "en";
  const [subjects, schedule] = await Promise.all([getSubjects(), getSchedule()]);
  const am = locale === "am" ? "am" : "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {schedule && (
        <div className="mb-10 max-w-3xl">
          <TodayCard entries={schedule.entries} overrides={schedule.overrides} locale={locale} />
          <ScheduleLive />
        </div>
      )}
      <h1 className={`text-2xl font-semibold tracking-tight text-ink sm:text-3xl ${am}`}>{t(locale, "chooseSubject")}</h1>
      <p className={`mt-1 text-muted ${am}`}>{t(locale, "chooseSubjectSub")}</p>

      <Stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {subjects.map((s, i) => {
          const ready = s.lessonCount > 0 && s.status !== "coming_soon";
          return (
            <StaggerItem key={s.id}>
              <Link
                href={`/${s.slug}`}
                style={subjectStyle(s.slug, s.color)}
                aria-disabled={s.status === "coming_soon" || undefined}
                tabIndex={s.status === "coming_soon" ? -1 : undefined}
                className={`group card-hover flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface hover:border-[color:var(--accent)] ${s.status === "coming_soon" ? "pointer-events-none" : ""}`}
              >
                <div className="bg-[var(--accent-tint)] px-6 pt-6 pb-4">
                  <Image
                    src={s.illustration || `/illustrations/subjects/${s.slug}.svg`}
                    alt=""
                    width={320}
                    height={240}
                    priority={i < 2}
                    className="mx-auto h-36 w-auto transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className={`text-lg font-semibold text-ink ${am}`}>{loc(s, "name", locale)}</h2>
                  <div className="mt-auto flex items-center justify-between pt-4">
                    {ready ? (
                      <span className={`rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink ${am}`}>
                        {s.lessonCount === 1 ? t(locale, "lessonReady") : t(locale, "lessonsReady", { n: s.lessonCount })}
                      </span>
                    ) : (
                      <span className={`rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-faint ${am}`}>
                        {t(locale, "comingSoon")}
                      </span>
                    )}
                    <ArrowRight
                      className="size-4 text-faint transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent"
                      aria-hidden
                    />
                  </div>
                </div>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      <p className={`mt-10 text-xs text-faint ${am}`}>
        {t(locale, "illustrations")}{" "}
        <a href="https://undraw.co" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          unDraw
        </a>{" "}
        {t(locale, "freeLicence")}
      </p>
    </div>
  );
}
