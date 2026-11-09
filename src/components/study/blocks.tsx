import { LessonImage } from "@/components/study/lesson-image";
import { BookMarked, Brain, CircleAlert, FlaskRound, Info, Lightbulb, Star } from "lucide-react";
import type { Block, Lang } from "@/lib/types";
import { BiText } from "@/components/study/text";

/** Renders one structured note block in the chosen language mode. */
export function NoteBlock({ block, lang }: { block: Block; lang: Lang }) {
  switch (block.type) {
    case "heading":
      return (
        <h3 className="mt-8 mb-3 text-lg font-semibold text-ink first:mt-0">
          <BiText value={block.text} lang={lang} single />
        </h3>
      );

    case "paragraph":
      return (
        <p className="my-4 text-[1.02rem] leading-relaxed text-ink/90">
          <BiText value={block.text} lang={lang} />
        </p>
      );

    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className="my-4 space-y-2.5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-ink/90">
              {block.ordered ? (
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">
                  {i + 1}
                </span>
              ) : (
                <span className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              )}
              <span className="min-w-0">
                <BiText value={it} lang={lang} />
              </span>
            </li>
          ))}
        </Tag>
      );
    }

    case "keypoint": {
      const v = block.variant ?? "definition";
      const style =
        v === "important"
          ? { box: "border-tip/40 bg-tip-soft", title: "text-tip", Icon: Star }
          : v === "note"
            ? { box: "border-note/25 bg-note-soft", title: "text-note", Icon: Info }
            : { box: "border-accent/30 bg-accent-soft", title: "text-accent-ink", Icon: BookMarked };
      return (
        <div className={`my-5 rounded-xl border-l-4 px-4 py-3.5 sm:px-5 ${style.box}`}>
          <p className={`flex items-center gap-2 text-sm font-semibold ${style.title}`}>
            <style.Icon className="size-4 shrink-0" aria-hidden />
            <BiText value={block.title} lang={lang} single />
          </p>
          <p className="mt-1.5 leading-relaxed text-ink">
            <BiText value={block.text} lang={lang} />
          </p>
        </div>
      );
    }

    case "example":
      return (
        <div className="my-5 rounded-xl border border-dashed border-accent/40 bg-surface px-4 py-3.5 sm:px-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent-ink">
            <FlaskRound className="size-4 shrink-0" aria-hidden />
            <BiText value={block.title} lang={lang} single />
          </p>
          <p className="mt-1.5 leading-relaxed text-ink/90">
            <BiText value={block.text} lang={lang} />
          </p>
        </div>
      );

    case "tip":
      return (
        <div className="my-5 flex gap-3 rounded-xl bg-tip-soft px-4 py-3.5 sm:px-5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/70 text-tip">
            <Brain className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-tip">
              <BiText value={block.title} lang={lang} single />
            </p>
            <p className="mt-1 leading-relaxed text-ink">
              <BiText value={block.text} lang={lang} />
            </p>
          </div>
        </div>
      );

    case "terms":
      return (
        <div className="my-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Lightbulb className="size-4 text-accent" aria-hidden />
            <BiText value={block.title} lang={lang} single />
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {block.items.map((t, i) => (
              <li key={i} className="rounded-full border border-accent/25 bg-accent-soft px-3.5 py-1.5 text-sm font-medium text-accent-ink">
                {lang === "am" ? (
                  <span className="am">{t.am}</span>
                ) : (
                  <>
                    {t.en}
                    {lang === "both" && t.am !== t.en && <span className="am ml-1.5 font-normal text-muted">· {t.am}</span>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      );

    case "table":
      return (
        <figure className="my-5">
          {block.caption && (
            <figcaption className="mb-2 text-sm font-medium text-muted">
              <BiText value={block.caption} lang={lang} single />
            </figcaption>
          )}
          <div className="table-scroll rounded-xl border border-line">
            <table className="w-full min-w-[30rem] border-collapse text-left text-[0.95rem]">
              <thead>
                <tr className="bg-accent-soft">
                  {block.headers.map((h, i) => (
                    <th key={i} scope="col" className="px-3.5 py-2.5 text-sm font-semibold text-accent-ink">
                      <BiText value={h} lang={lang} single />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="border-t border-line align-top even:bg-paper/60">
                    {row.map((cell, c) => (
                      <td key={c} className="px-3.5 py-3 leading-relaxed text-ink/90">
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
          width={block.width}
          height={block.height}
        >
          <figcaption className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
            {block.caption && (
              <span className="text-muted">
                <BiText value={block.caption} lang={lang} single />
              </span>
            )}
            <span className="text-xs text-faint">
              {block.creditUrl ? (
                <a href={block.creditUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                  {block.credit}
                </a>
              ) : (
                block.credit
              )}
            </span>
          </figcaption>
        </LessonImage>
      );

    default:
      return (
        <p className="my-4 flex items-center gap-2 text-sm text-bad">
          <CircleAlert className="size-4" aria-hidden /> Unsupported note block
        </p>
      );
  }
}
