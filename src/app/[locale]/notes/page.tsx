import type { Metadata } from "next";
import { getNotesIndex, getSubjects } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";
import { NotesHome } from "@/components/notes/notes-home";

export async function generateMetadata({ params }: PageProps<"/[locale]/notes">): Promise<Metadata> {
  const { locale } = await params;
  return { title: t(isLocale(locale) ? locale : "en", "notes"), robots: { index: false } };
}

/** Notes home: the lesson index is public (cached); the boards themselves load in the browser (own data only). */
export default async function NotesPage({ params }: PageProps<"/[locale]/notes">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "en";
  const [lessons, subjects] = await Promise.all([getNotesIndex(), getSubjects()]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <NotesHome lessons={lessons} subjects={subjects.map((x) => ({ id: x.id, slug: x.slug, name_en: x.name_en, name_am: x.name_am, color: x.color ?? null }))} locale={locale} />
    </div>
  );
}
