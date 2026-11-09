import Link from "next/link";
import { LogoMark } from "@/components/subject-icon";

const SUBJECTS = [
  { slug: "mathematics", name: "Mathematics" },
  { slug: "english", name: "English" },
  { slug: "geography", name: "Geography" },
  { slug: "history", name: "History" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-ink">
          <LogoMark />
          <span className="text-[15px] sm:text-base">Unity Social Rem</span>
        </Link>
        <nav aria-label="Subjects" className="no-scrollbar ml-auto hidden items-center gap-1 overflow-x-auto md:flex">
          {SUBJECTS.map((s) => (
            <Link
              key={s.slug}
              href={`/${s.slug}`}
              className="rounded-full px-3.5 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              {s.name}
            </Link>
          ))}
        </nav>
        <Link
          href="/#subjects"
          className="ml-auto rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink md:hidden"
        >
          Subjects
        </Link>
      </div>
    </header>
  );
}
