import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { getSubjectParams, getSubjectTree } from "@/lib/data";
import { subjectStyle } from "@/lib/subjects";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";
import { Stagger, StaggerItem } from "@/components/motion";

export async function generateStaticParams() {
  return getSubjectParams();
}

export async function generateMetadata({ params }: PageProps<"/[subject]">): Promise<Metadata> {
  const tree = await getSubjectTree((await params).subject);
  return { title: tree?.name_en ?? "Subject" };
}

export default async function SubjectPage({ params }: PageProps<"/[subject]">) {
  const { subject } = await params;
  const tree = await getSubjectTree(subject);
  if (!tree) notFound();

  const hasAny = tree.grades.some((g) => g.units.length > 0);

  return (
    <div style={subjectStyle(tree.slug)} className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: tree.name_en }]} />
      <PageHeader subjectSlug={tree.slug} title={tree.name_en} titleAm={tree.name_am} description={tree.description_en} />

      <h2 className="mt-10 text-lg font-semibold text-ink">Choose your grade</h2>
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
                }`}
              >
                <span
                  className={`grid size-14 shrink-0 place-items-center rounded-xl text-xl font-semibold ${
                    ready ? "bg-accent-soft text-accent-ink" : "bg-paper text-faint"
                  }`}
                >
                  {g.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{g.name_en}</p>
                  <p className="am text-sm text-faint">{g.name_am}</p>
                  <p className="mt-1 text-sm text-muted">
                    {ready ? (
                      <>
                        {g.units.length} {g.units.length === 1 ? "unit" : "units"} · {lessons} {lessons === 1 ? "lesson" : "lessons"}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" aria-hidden /> Coming soon
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
            message={`We're writing ${tree.name_en} notes, summaries and quizzes right now. Check back soon.`}
            backHref="/geography/grade-9/unit-1"
            backLabel="Study Geography Grade 9 meanwhile"
          />
        </div>
      )}
    </div>
  );
}
