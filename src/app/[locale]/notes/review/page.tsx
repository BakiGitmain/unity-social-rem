import type { Metadata } from "next";
import { isLocale, type Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";
import { Review } from "@/components/notes/review";

export async function generateMetadata({ params }: PageProps<"/[locale]/notes/review">): Promise<Metadata> {
  const { locale } = await params;
  return { title: t(isLocale(locale) ? locale : "en", "review"), robots: { index: false } };
}

export default async function ReviewPage({ params }: PageProps<"/[locale]/notes/review">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "en";
  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10">
      <Review locale={locale} />
    </div>
  );
}
