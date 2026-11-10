import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { getSubjectTree, getUnitParams } from "@/lib/data";
import { subjectStyle } from "@/lib/subjects";
import { isLocale, loc, type Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";
import type { LessonSummary } from "@/lib/types";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Stagger, StaggerItem } from "@/components/motion";
import { LessonProgressBadge } from "@/components/study/progress-badge";

export async function generateStaticParams() {
  return getUnitParams();
}

export async function generateMetadata({ params }: PageProps<"/[locale]/[subject]/[grade]/[unit]">): Promise<Metadata> {
  const { locale: l, subject, grade, unit } = await params;
  const locale: Locale = isLocale(l) ? l : "en";
  const tree = await getSubjectTree(subject);
  const u = tree?.grades.find((x) => x.slug === grade)?.units.find((x) => x.slug === unit);
  return { title: u ? `${loc(u, "label", locale)}: ${loc(u, "title", locale)}` : "Unit" };
}

export default async function UnitPage({ params }: PageProps<"/[locale]/[subject]/[grade]/[unit]">) {
  const { locale: l, subject, grade, unit } = await params;
  const locale: Locale = isLocale(l) ? l : "en";
  const tree = await getSubjectTree(subject);
  const g = tree?.grades.find((x) => x.slug === grade);
  const u = g?.units.find((x) => x.slug === unit);
  if (!tree || !g || !u) notFound();

  const am = locale === "am";
  const groups = new Map<string, { code: string; title: string; lessons: LessonSummary[] }>();
  for (const lesson of u.lessons) {
    const key = lesson.section_code || "_";
    if (!groups.has(key))
      groups.set(key, { code: lesson.section_code, title: loc(lesson, "section_title", locale), lessons: [] });
    groups.get(key)!.lessons.push(lesson);
  }

  const base = `/${tree.slug}/${g.slug}/${u.slug}`;

  return (
    <div style={subjectStyle(tree.slug)} className={`mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 ${am ? "am" : ""}`}>
      <Breadcrumbs
        am={am}
        items={[
          { label: loc(tree, "name", locale), href: `/${tree.slug}` },
          { label: loc(g, "name", locale), href: `/${tree.slug}/${g.slug}` },
          { label: loc(u, "label", locale) },
        ]}
      />

      <header className="mt-6">
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-accent-ink">
          {loc(tree, "name", locale)} · {loc(g, "name", locale)} · {loc(u, "label", locale)}
        </span>
        <h1 className="mt-3 text-2xl leading-tight font-semibold tracking-tight text-ink sm:text-3xl">{loc(u, "title", locale)}</h1>
        {loc(u, "description", locale) && <p className="mt-2 max-w-2xl text-muted">{loc(u, "description", locale)}</p>}
      </header>

      {u.lessons.length === 0 && <p className="mt-10 text-muted">{t(locale, "lessonsComing")}</p>}

      {[...groups.values()].map((group) => (
        <section key={group.code} className="mt-10">
          {group.code && (
            <h2 className="text-lg font-semibold text-ink">
              <span className="text-accent">{group.code}</span> {group.title}
            </h2>
          )}
          <Stagger className="mt-4 space-y-3">
            {group.lessons.map((lesson) => (
              <StaggerItem key={lesson.id}>
                <Link
                  href={`${base}/${lesson.slug}`}
                  className="group card-hover flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-[color:var(--accent)] hover:bg-[var(--accent-tint)] sm:p-5"
                >
                  <span className="grid h-11 min-w-14 shrink-0 place-items-center rounded-xl bg-accent-soft px-2 text-sm font-semibold text-accent-ink tabular-nums">
                    {lesson.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{loc(lesson, "title", locale)}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{loc(lesson, "summary", locale)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-faint">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden />
                        {t(locale, "aboutMin", { n: lesson.minutes })}
                      </span>
                      <LessonProgressBadge lessonId={lesson.id} total={lesson.partCount ?? 0} locale={locale} />
                    </div>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-faint transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent" aria-hidden />
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      ))}
    </div>
  );
}
