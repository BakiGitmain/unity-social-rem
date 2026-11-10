import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { getSubjectParams, getSubjectTree } from "@/lib/data";
import { subjectStyle } from "@/lib/subjects";
import { isLocale, loc, type Locale } from "@/lib/locale";
import { t, unitsLessons } from "@/lib/site-i18n";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";
import { Stagger, StaggerItem } from "@/components/motion";

export async function generateStaticParams() {
  return getSubjectParams();
}

export async function generateMetadata({ params }: PageProps<"/[locale]/[subject]">): Promise<Metadata> {
  const { locale, subject } = await params;
  const tree = await getSubjectTree(subject);
  return { title: tree ? loc(tree, "name", isLocale(locale) ? locale : "en") : "Subject" };
}

export default async function SubjectPage({ params }: PageProps<"/[locale]/[subject]">) {
  const { locale: l, subject } = await params;
  const locale: Locale = isLocale(l) ? l : "en";
  const tree = await getSubjectTree(subject);
  if (!tree) notFound();

  const am = locale === "am";
  const name = loc(tree, "name", locale);
  const hasAny = tree.grades.some((g) => g.units.length > 0);

  return (
    <div style={subjectStyle(tree.slug)} className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs am={am} items={[{ label: t(locale, "home"), href: "/" }, { label: name }]} />
      <PageHeader subjectSlug={tree.slug} title={name} description={loc(tree, "description", locale)} am={am} />

      <h2 className={`mt-10 text-lg font-semibold text-ink ${am ? "am" : ""}`}>{t(locale, "chooseGrade")}</h2>
      <Stagger className="mt-4 grid gap-4 sm:grid-cols-2">
        {tree.grades.map((g) => {
          const lessons = g.units.reduce((n, u) => n + u.lessons.length, 0);
          const ready = g.units.length > 0;
          return (
            <StaggerItem key={g.id}>
              <Link
                href={`/${tree.slug}/${g.slug}`}
                className={`group card-hover flex h-full items-center gap-4 rounded-2xl border p-5 ${
                  ready
                    ? "border-line bg-surface hover:border-[color:var(--accent)] hover:bg-[var(--accent-tint)]"
                    : "border-line/80 bg-surface/60 hover:border-line-strong"
                } ${am ? "am" : ""}`}
              >
                <span
                  className={`grid size-14 shrink-0 place-items-center rounded-xl text-xl font-semibold ${
                    ready ? "bg-accent-soft text-accent-ink" : "bg-paper text-faint"
                  }`}
                >
                  {g.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{loc(g, "name", locale)}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {ready ? (
                      unitsLessons(locale, g.units.length, lessons)
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" aria-hidden /> {t(locale, "comingSoon")}
                      </span>
                    )}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-faint transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent" aria-hidden />
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      {!hasAny && (
        <div className="mt-10">
          <ComingSoon
            am={am}
            title={t(locale, "comingSoon")}
            message={t(locale, "subjectComing", { subject: name })}
            backHref="/geography/grade-9/unit-1"
            backLabel={t(locale, "studyMeanwhile")}
          />
        </div>
      )}
    </div>
  );
}
