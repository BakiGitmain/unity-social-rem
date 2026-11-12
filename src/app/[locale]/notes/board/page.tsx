import type { Metadata } from "next";
import { getNotesIndex } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";
import { BoardLoader } from "@/components/notes/board-loader";

export async function generateMetadata({ params }: PageProps<"/[locale]/notes/board">): Promise<Metadata> {
  const { locale } = await params;
  return { title: t(isLocale(locale) ? locale : "en", "notes"), robots: { index: false } };
}

/**
 * A notes board: /notes/board?id=<board id>. The board is private and loads in the browser (the id is read
 * there), so this page stays static. React Flow is only downloaded here (lazy).
 */
export default async function BoardPage({ params }: PageProps<"/[locale]/notes/board">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "en";
  const lessons = await getNotesIndex();
  return <BoardLoader locale={locale} lessons={lessons} />;
}
