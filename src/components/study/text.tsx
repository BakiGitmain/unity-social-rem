import { Fragment } from "react";
import type { Bi, Lang } from "@/lib/types";

/** Renders inline `**key term**` markup as a highlighted term. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="key-term">
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Bilingual text.
 *  en   → English
 *  am   → Amharic
 *  both → English, with the Amharic explanation directly under it in a softer style
 * `single` forces one line (used for headings, which stay English in "both").
 */
export function BiText({ value, lang, single = false }: { value: Bi; lang: Lang; single?: boolean }) {
  if (lang === "am")
    return (
      <span className="am" lang="am">
        <Rich text={value.am} />
      </span>
    );
  if (lang === "en" || single || value.am === value.en) return <Rich text={value.en} />;
  return (
    <>
      <Rich text={value.en} />
      <span className="bi-am" lang="am">
        <Rich text={value.am} />
      </span>
    </>
  );
}
