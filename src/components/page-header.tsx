import { SubjectIcon } from "@/components/subject-icon";

/** Title block for subject / grade / unit pages. */
export function PageHeader({
  subjectSlug,
  eyebrow,
  title,
  titleAm,
  description,
}: {
  subjectSlug: string;
  eyebrow?: string;
  title: string;
  titleAm?: string;
  description?: string;
}) {
  return (
    <div className="mt-6 flex items-start gap-4 sm:items-center">
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-line bg-surface sm:size-16">
        <SubjectIcon slug={subjectSlug} className="size-10 sm:size-11" />
      </span>
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-medium text-accent-ink">{eyebrow}</p>}
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {titleAm && <p className="am text-muted">{titleAm}</p>}
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
    </div>
  );
}
