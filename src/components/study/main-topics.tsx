"use client";

import { CheckCircle2 } from "lucide-react";
import type { Lang, MainTopic } from "@/lib/types";
import type { Locale } from "@/lib/locale";
import { t } from "@/lib/site-i18n";
import { BiText } from "@/components/study/text";

export function MainTopics({ topics, lang, locale }: { topics: MainTopic[]; lang: Lang; locale: Locale }) {
  return (
    <div>
      <p className={`mb-6 max-w-[65ch] text-muted ${locale === "am" ? "am" : ""}`}>{t(locale, "topicsIntro")}</p>
      <ol className="grid gap-4 md:grid-cols-2">
        {topics.map((topic, i) => (
          <li key={i} className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
            <h3 className={`flex items-center gap-3 text-[17px] font-semibold text-ink ${lang === "am" ? "am" : ""}`}>
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-sm font-semibold text-white">{i + 1}</span>
              <BiText value={topic.title} lang={lang} single />
            </h3>
            <ul className="mt-4 space-y-3">
              {topic.points.map((p, j) => (
                <li key={j} className="flex gap-2.5 text-[16px] leading-relaxed text-ink/90 sm:text-[17px]">
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
