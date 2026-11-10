import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLessonContent, getLessonParams, getSubjectTree, type SubjectTree } from "@/lib/data";
import { subjectStyle } from "@/lib/subjects";
import { isLocale, loc, type Locale } from "@/lib/locale";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StudyView } from "@/components/study/study-view";

type Params = PageProps<"/[locale]/[subject]/[grade]/[unit]/[lesson]">["params"];

export async function generateStaticParams() {
  return getLessonParams();
}

async function resolve(params: Params) {
  const { locale: l, subject, grade, unit, lesson } = await params;
  const locale: Locale = isLocale(l) ? l : "en";
  const tree = await getSubjectTree(subject);
  const g = tree?.grades.find((x) => x.slug === grade);
  const u = g?.units.find((x) => x.slug === unit);
  const ls = u?.lessons.find((x) => x.slug === lesson);
  if (!tree || !g || !u || !ls) return null;
  return { locale, tree, g, u, l: ls };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return { title: "Lesson" };
  return { title: `${r.l.code} ${loc(r.l, "title", r.locale)}`, description: loc(r.l, "summary", r.locale) };
}

/** Lessons of the whole grade in study order, for previous/next buttons across units. */
function neighbours(tree: SubjectTree, gradeSlug: string, lessonId: string) {
  const g = tree.grades.find((x) => x.slug === gradeSlug)!;
  const flat = g.units.flatMap((u) =>
    u.lessons.map((l) => ({
      id: l.id,
      href: `/${tree.slug}/${g.slug}/${u.slug}/${l.slug}`,
      code: l.code,
      title_en: l.title_en,
      title_am: l.title_am,
    })),
  );
  const i = flat.findIndex((x) => x.id === lessonId);
  return { prev: i > 0 ? flat[i - 1] : null, next: i >= 0 && i < flat.length - 1 ? flat[i + 1] : null };
}

export default async function LessonPage({ params }: { params: Params }) {
  const r = await resolve(params);
  if (!r) notFound();
  const { locale, tree, g, u, l } = r;

  const content = await getLessonContent(l.id);
  const { prev, next } = neighbours(tree, g.slug, l.id);

  return (
    <div style={subjectStyle(tree.slug)} className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs
        am={locale === "am"}
        items={[
          { label: loc(tree, "name", locale), href: `/${tree.slug}` },
          { label: loc(g, "name", locale), href: `/${tree.slug}/${g.slug}` },
          { label: loc(u, "label", locale), href: `/${tree.slug}/${g.slug}/${u.slug}` },
          { label: l.code },
        ]}
      />
      <StudyView
        locale={locale}
        lesson={l}
        sections={content.sections}
        mainTopics={content.mainTopics}
        glossary={content.glossary}
        quiz={content.quiz}
        prev={prev}
        next={next}
        unitHref={`/${tree.slug}/${g.slug}/${u.slug}`}
        unitLabel={`${loc(tree, "name", locale)} · ${loc(g, "name", locale)} · ${loc(u, "label", locale)}`}
      />
    </div>
  );
}
