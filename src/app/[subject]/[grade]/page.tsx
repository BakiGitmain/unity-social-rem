import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";
import { getGradeParams, getSubjectTree } from "@/lib/data";
import { subjectStyle } from "@/lib/subjects";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";
import { Stagger, StaggerItem } from "@/components/motion";

export async function generateStaticParams() {
  return getGradeParams();
}

export async function generateMetadata({ params }: PageProps<"/[subject]/[grade]">): Promise<Metadata> {
  const { subject, grade } = await params;
  const tree = await getSubjectTree(subject);
  const g = tree?.grades.find((x) => x.slug === grade);
  return { title: tree && g ? `${tree.name_en} ${g.name_en}` : "Grade" };
}

export default async function GradePage({ params }: PageProps<"/[subject]/[grade]">) {
  const { subject, grade } = await params;
  const tree = await getSubjectTree(subject);
  const g = tree?.grades.find((x) => x.slug === grade);
  if (!tree || !g) notFound();

  return (
    <div style={subjectStyle(tree.slug)} className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: tree.name_en, href: `/${tree.slug}` },
          { label: g.name_en },
        ]}
      />
      <PageHeader
        subjectSlug={tree.slug}
        eyebrow={tree.name_en}
        title={g.name_en}
        titleAm={`${tree.name_am} · ${g.name_am}`}
        description={g.curriculum_en || undefined}
      />

      {g.units.length === 0 ? (
        <div className="mt-10">
          <ComingSoon
            message={`${tree.name_en} ${g.name_en} is on its way. We add new units regularly.`}
            backHref={`/${tree.slug}`}
            backLabel={`All ${tree.name_en} grades`}
          />
        </div>
      ) : (
        <>
          <h2 className="mt-10 text-lg font-semibold text-ink">Units</h2>
          <Stagger className="mt-4 grid gap-4 md:grid-cols-2">
            {g.units.map((u) => (
              <StaggerItem key={u.id}>
                <Link
                  href={`/${tree.slug}/${g.slug}/${u.slug}`}
                  className="group card-hover flex h-full flex-col rounded-2xl border border-line bg-surface p-5 hover:border-[color:var(--accent)] hover:bg-[var(--accent-tint)] sm:p-6"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-accent-ink uppercase">
                      {u.label_en}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                      <BookOpen className="size-4" aria-hidden />
                      {u.lessons.length} {u.lessons.length === 1 ? "lesson" : "lessons"}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink">{u.title_en}</h3>
                  <p className="am text-sm text-faint">{u.title_am}</p>
                  {u.description_en && <p className="mt-2 text-sm text-muted">{u.description_en}</p>}
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-accent-ink">
                    Open unit
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
