import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { getSubjectTree, getUnitParams } from "@/lib/data";
import { subjectStyle } from "@/lib/subjects";
import type { LessonSummary } from "@/lib/types";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Stagger, StaggerItem } from "@/components/motion";

export async function generateStaticParams() {
  return getUnitParams();
}

export async function generateMetadata({ params }: PageProps<"/[subject]/[grade]/[unit]">): Promise<Metadata> {
  const { subject, grade, unit } = await params;
  const tree = await getSubjectTree(subject);
  const u = tree?.grades.find((x) => x.slug === grade)?.units.find((x) => x.slug === unit);
  return { title: u ? `${u.label_en}: ${u.title_en}` : "Unit" };
}

export default async function UnitPage({ params }: PageProps<"/[subject]/[grade]/[unit]">) {
  const { subject, grade, unit } = await params;
  const tree = await getSubjectTree(subject);
  const g = tree?.grades.find((x) => x.slug === grade);
  const u = g?.units.find((x) => x.slug === unit);
  if (!tree || !g || !u) notFound();

  // Group lessons by their section (e.g. "1.1 The Science of Geography").
  const groups = new Map<string, { code: string; title_en: string; title_am: string; lessons: LessonSummary[] }>();
  for (const l of u.lessons) {
    const key = l.section_code || "_";
    if (!groups.has(key))
      groups.set(key, { code: l.section_code, title_en: l.section_title_en, title_am: l.section_title_am, lessons: [] });
    groups.get(key)!.lessons.push(l);
  }

  const base = `/${tree.slug}/${g.slug}/${u.slug}`;

  return (
    <div style={subjectStyle(tree.slug)} className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: tree.name_en, href: `/${tree.slug}` },
          { label: g.name_en, href: `/${tree.slug}/${g.slug}` },
          { label: u.label_en },
        ]}
      />

      <header className="mt-6">
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-accent-ink uppercase">
          {tree.name_en} · {g.name_en} · {u.label_en}
        </span>
        <h1 className="mt-3 text-2xl leading-tight font-semibold tracking-tight text-ink sm:text-3xl">{u.title_en}</h1>
        <p className="am text-muted">{u.title_am}</p>
        {u.description_en && <p className="mt-2 max-w-2xl text-muted">{u.description_en}</p>}
      </header>

      {u.lessons.length === 0 && <p className="mt-10 text-muted">Lessons for this unit are coming soon.</p>}

      {[...groups.values()].map((group) => (
        <section key={group.code} className="mt-10">
          {group.code && (
            <h2 className="flex flex-wrap items-baseline gap-x-2 text-lg font-semibold text-ink">
              <span className="text-accent">{group.code}</span> {group.title_en}
              <span className="am text-sm font-normal text-faint">{group.title_am}</span>
            </h2>
          )}
          <Stagger className="mt-4 space-y-3">
            {group.lessons.map((l) => (
              <StaggerItem key={l.id}>
                <Link
                  href={`${base}/${l.slug}`}
                  className="group card-hover flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-[color:var(--accent)] hover:bg-[var(--accent-tint)] sm:p-5"
                >
                  <span className="grid h-11 min-w-14 shrink-0 place-items-center rounded-xl bg-accent-soft px-2 text-sm font-semibold text-accent-ink tabular-nums">
                    {l.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{l.title_en}</p>
                    <p className="am text-sm text-faint">{l.title_am}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{l.summary_en}</p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 text-sm text-faint sm:flex">
                    <Clock className="size-4" aria-hidden />
                    {l.minutes} min
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
