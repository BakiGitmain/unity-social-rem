"use client";

import { BookMarked, Brain, Info, Lightbulb, Star } from "lucide-react";
import type { Block, Lang } from "@/lib/types";
import { BiText, KeyPhrase } from "@/components/study/text";
import { LessonImage } from "@/components/study/lesson-image";
import { SectionIcon } from "@/components/study/section-icon";
import { VennBlock } from "@/components/math/venn-block";
import { WorkedExample } from "@/components/math/worked-example";

/* Readability: 17–18px body, generous line-height, few borders. Line length is capped by the parent (≈65ch). */
const body = "text-[17px] leading-[1.75] sm:text-[18px] text-ink/90";

/** Renders one structured note block in the chosen notes-language mode. */
export function NoteBlock({ block, lang }: { block: Block; lang: Lang }) {
  switch (block.type) {
    case "heading":
      return (
        <h3 className="mt-9 mb-2 text-lg font-semibold text-ink first:mt-0">
          <BiText value={block.text} lang={lang} single />
        </h3>
      );

    case "paragraph":
      return (
        <p className={`my-5 first:mt-0 ${body}`}>
          <BiText value={block.text} lang={lang} />
        </p>
      );

    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className="my-5 space-y-3">
          {block.items.map((it, i) => (
            <li key={i} className={`flex gap-3 ${body}`}>
              {block.ordered ? (
                <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">
                  {i + 1}
                </span>
              ) : (
                <span className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              )}
              <span className="min-w-0">
                <BiText value={it} lang={lang} />
              </span>
            </li>
          ))}
        </Tag>
      );
    }

    case "points":
      return (
        <ul className="my-6 space-y-4">
          {block.items.map((it, i) => {
            const title = lang === "am" ? it.title.am : it.title.en;
            return (
              <li key={i} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <SectionIcon name={it.icon} className="size-5" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className={`font-semibold text-ink ${lang === "am" ? "am" : ""} text-[17px] sm:text-[18px]`}>
                    <KeyPhrase text={title} />
                    {lang === "both" && it.title.am !== it.title.en && (
                      <span className="am ml-2 text-[15px] font-normal text-muted">{it.title.am}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[16px] leading-relaxed text-muted sm:text-[17px]">
                    <BiText value={it.text} lang={lang} />
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      );

    case "keypoint": {
      const v = block.variant ?? "definition";
      const style =
        v === "important"
          ? { box: "bg-tip-soft", title: "text-tip", Icon: Star }
          : v === "note"
            ? { box: "bg-note-soft", title: "text-note", Icon: Info }
            : { box: "bg-accent-soft", title: "text-accent-ink", Icon: BookMarked };
      return (
        <div className={`my-6 rounded-2xl px-5 py-4 ${style.box}`}>
          <p className={`flex items-center gap-2 text-sm font-semibold ${style.title}`}>
            {block.icon ? <SectionIcon name={block.icon} className="size-4 shrink-0" /> : <style.Icon className="size-4 shrink-0" aria-hidden />}
            <BiText value={block.title} lang={lang} single />
          </p>
          <p className={`mt-1.5 ${body} text-ink`}>
            <BiText value={block.text} lang={lang} />
          </p>
        </div>
      );
    }

    case "example":
      return (
        <div className="my-6 border-l-[3px] border-accent/40 pl-4">
          <p className="text-sm font-semibold text-accent-ink">
            <BiText value={block.title} lang={lang} single />
          </p>
          <p className={`mt-1 ${body}`}>
            <BiText value={block.text} lang={lang} />
          </p>
        </div>
      );

    case "tip":
      return (
        <div className="my-6 flex gap-3 rounded-2xl bg-tip-soft px-4 py-4 sm:px-5">
          <Brain className="mt-0.5 size-5 shrink-0 text-tip" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-tip">
              <BiText value={block.title} lang={lang} single />
            </p>
            <p className={`mt-1 ${body} text-ink`}>
              <BiText value={block.text} lang={lang} />
            </p>
          </div>
        </div>
      );

    case "terms":
      return (
        <div className="my-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Lightbulb className="size-4 text-accent" aria-hidden />
            <BiText value={block.title} lang={lang} single />
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {block.items.map((it, i) => (
              <li key={i} className="rounded-full bg-accent-soft px-4 py-2 text-[15px] font-medium text-accent-ink">
                {lang === "am" ? (
                  <span className="am">{it.am}</span>
                ) : (
                  <>
                    {it.en}
                    {lang === "both" && it.am !== it.en && <span className="am ml-1.5 font-normal text-muted">· {it.am}</span>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      );

    case "table":
      return (
        <figure className="my-6">
          {block.caption && (
            <figcaption className="mb-2 text-sm font-medium text-muted">
              <BiText value={block.caption} lang={lang} single />
            </figcaption>
          )}

          {/* Phones: every row becomes a small card (label: value), nothing scrolls sideways. */}
          <ul className="space-y-3 sm:hidden">
            {block.rows.map((row, r) => (
              <li key={r} className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                <p className="text-[17px] font-semibold text-ink">
                  <BiText value={row[0]} lang={lang} />
                </p>
                <dl className="mt-2 space-y-2">
                  {row.slice(1).map((cell, c) => (
                    <div key={c}>
                      <dt className="text-xs font-semibold tracking-wide text-accent-ink uppercase">
                        <BiText value={block.headers[c + 1]} lang={lang} single />
                      </dt>
                      <dd className="text-[16px] leading-relaxed text-ink/90">
                        <BiText value={cell} lang={lang} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          {/* Tablets and desktop: a normal table. */}
          <div className="hidden overflow-hidden rounded-2xl ring-1 ring-line sm:block">
            <table className="w-full border-collapse text-left text-[16px]">
              <thead>
                <tr className="bg-accent-soft">
                  {block.headers.map((h, i) => (
                    <th key={i} scope="col" className="px-4 py-3 text-sm font-semibold text-accent-ink">
                      <BiText value={h} lang={lang} single />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-surface">
                {block.rows.map((row, r) => (
                  <tr key={r} className="border-t border-line align-top">
                    {row.map((cell, c) => (
                      <td key={c} className={`px-4 py-3 leading-relaxed ${c === 0 ? "text-ink" : "text-ink/85"}`}>
                        <BiText value={cell} lang={lang} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      );

    case "image":
      return (
        <LessonImage
          src={block.src}
          alt={lang === "am" ? block.alt.am : block.alt.en}
          caption={block.caption ? <BiText value={block.caption} lang={lang} single /> : undefined}
          credit={
            block.creditUrl ? (
              <a href={block.creditUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                {block.credit}
              </a>
            ) : (
              block.credit
            )
          }
        />
      );

    case "venn":
      return <VennBlock block={block} lang={lang} />;

    case "worked":
      return <WorkedExample title={block.title} problem={block.problem} steps={block.steps} answer={block.answer} venn={block.venn} lang={lang} />;

    default:
      // Unknown block types are skipped silently rather than showing an error to students.
      return null;
  }
}
