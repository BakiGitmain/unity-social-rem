import { CheckCircle2 } from "lucide-react";
import type { Lang, MainTopic } from "@/lib/types";
import { ui } from "@/lib/i18n";
import { BiText } from "@/components/study/text";

export function MainTopics({ topics, lang }: { topics: MainTopic[]; lang: Lang }) {
  return (
    <div>
      <p className={`mb-6 max-w-2xl text-muted ${lang === "am" ? "am" : ""}`}>{ui("topicsIntro", lang)}</p>
      <ol className="grid gap-4 md:grid-cols-2">
        {topics.map((t, i) => (
          <li key={i} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h3 className="flex items-center gap-3 font-semibold text-ink">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-sm font-semibold text-white">
                {i + 1}
              </span>
              <BiText value={t.title} lang={lang} single />
            </h3>
            <ul className="mt-4 space-y-3">
              {t.points.map((p, j) => (
                <li key={j} className="flex gap-2.5 leading-relaxed text-ink/90">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0">
                    <BiText value={p} lang={lang} />
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
