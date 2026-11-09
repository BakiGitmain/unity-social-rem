import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSubjects } from "@/lib/data";
import { subjectStyle } from "@/lib/subjects";
import { Stagger, StaggerItem } from "@/components/motion";

export default async function HomePage() {
  const subjects = await getSubjects();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Choose a subject</h1>
      <p className="mt-1 text-muted">Pick a subject, then your grade and unit.</p>

      <Stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {subjects.map((s, i) => {
          const ready = s.lessonCount > 0;
          return (
            <StaggerItem key={s.id}>
              <Link
                href={`/${s.slug}`}
                style={subjectStyle(s.slug)}
                className="group card-hover flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface hover:border-[color:var(--accent)]"
              >
                <div className="bg-[var(--accent-tint)] px-6 pt-6 pb-4">
                  <Image
                    src={`/illustrations/subjects/${s.slug}.svg`}
                    alt=""
                    width={320}
                    height={240}
                    priority={i < 2}
                    className="mx-auto h-36 w-auto transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-semibold text-ink">{s.name_en}</h2>
                  <p className="am text-sm text-faint">{s.name_am}</p>
                  <div className="mt-auto flex items-center justify-between pt-4">
                    {ready ? (
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink">
                        {s.lessonCount} {s.lessonCount === 1 ? "lesson" : "lessons"} ready
                      </span>
                    ) : (
                      <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-faint">Coming soon</span>
                    )}
                    <ArrowRight
                      className="size-4 text-faint transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent"
                      aria-hidden
                    />
                  </div>
                </div>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      <p className="mt-10 text-xs text-faint">
        Illustrations from{" "}
        <a href="https://undraw.co" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          unDraw
        </a>{" "}
        (free licence).
      </p>
    </div>
  );
}
