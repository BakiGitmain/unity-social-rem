import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";
import { getGradeParams, getSubjectTree } from "@/lib/data";
import { subjectStyle } from "@/lib/subjects";
import { ComingSoonBadge, SOON_LINK } from "@/components/coming-soon-badge";
import { isLocale, loc, type Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";
import { Stagger, StaggerItem } from "@/components/motion";
import { UnitProgress } from "@/components/study/progress-badge";

export async function generateStaticParams() {
  return getGradeParams();
}

export async function generateMetadata({ params }: PageProps<"/[locale]/[subject]/[grade]">): Promise<Metadata> {
  const { locale: l, subject, grade } = await params;
  const locale: Locale = isLocale(l) ? l : "en";
  const tree = await getSubjectTree(subject);
  const g = tree?.grades.find((x) => x.slug === grade);
  return { title: tree && g ? `${loc(tree, "name", locale)} · ${loc(g, "name", locale)}` : "Grade" };
}

export default async function GradePage({ params }: PageProps<"/[locale]/[subject]/[grade]">) {
  const { locale: l, subject, grade } = await params;
  const locale: Locale = isLocale(l) ? l : "en";
  const tree = await getSubjectTree(subject);
  const g = tree?.grades.find((x) => x.slug === grade);
  if (!tree || !g) notFound();

  const am = locale === "am";
  const subjectName = loc(tree, "name", locale);
  const gradeName = loc(g, "name", locale);

  return (
    <div style={subjectStyle(tree.slug, tree.color)} className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        am={am}
        items={[
          { label: t(locale, "home"), href: "/" },
          { label: subjectName, href: `/${tree.slug}` },
          { label: gradeName },
        ]}
      />
      <PageHeader
        am={am}
        subjectSlug={tree.slug}
        eyebrow={subjectName}
        title={gradeName}
        description={loc(g, "curriculum", locale) || undefined}
      />

      {g.units.length === 0 ? (
        <div className="mt-10">
          <ComingSoon
            am={am}
            title={t(locale, "comingSoon")}
            message={t(locale, "gradeComing", { subject: subjectName, grade: gradeName })}
            backHref={`/${tree.slug}`}
            backLabel={t(locale, "allGrades", { subject: subjectName })}
          />
        </div>
      ) : (
        <>
          <h2 className={`mt-10 text-lg font-semibold text-ink ${am ? "am" : ""}`}>{t(locale, "units")}</h2>
          <Stagger className="mt-4 grid gap-4 md:grid-cols-2">
            {g.units.map((u) => (
              <StaggerItem key={u.id}>
                <Link
                  href={`/${tree.slug}/${g.slug}/${u.slug}`}
                  aria-disabled={u.status === "coming_soon" || undefined}
                  tabIndex={u.status === "coming_soon" ? -1 : undefined}
                  className={`group card-hover relative flex h-full flex-col rounded-2xl border border-line bg-surface p-5 hover:border-[color:var(--accent)] hover:bg-[var(--accent-tint)] sm:p-6 ${am ? "am" : ""} ${u.status === "coming_soon" ? SOON_LINK : ""}`}
                >
                  {u.status === "coming_soon" && <ComingSoonBadge locale={locale} className="absolute top-4 right-4" />}
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-accent-ink">
                      {loc(u, "label", locale)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                      <BookOpen className="size-4" aria-hidden />
                      {u.lessons.length} {t(locale, u.lessons.length === 1 ? "lesson1" : "lessonN")}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink">{loc(u, "title", locale)}</h3>
                  {loc(u, "description", locale) && <p className="mt-2 text-sm text-muted">{loc(u, "description", locale)}</p>}
                  <UnitProgress locale={locale} lessons={u.lessons.map((l) => ({ id: l.id, parts: l.partCount ?? 0 }))} />
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-accent-ink">
                    {t(locale, "openUnit")}
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </>
      )}
    </div>
  );
}
