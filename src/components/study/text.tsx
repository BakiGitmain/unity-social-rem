"use client";

import { Fragment } from "react";
import type { Bi, Lang } from "@/lib/types";
import { Term, useGlossaryEntry } from "@/components/study/glossary";

/** A highlighted phrase: a tappable term if it is in the glossary, otherwise just bold. */
export function KeyPhrase({ text }: { text: string }) {
  const entry = useGlossaryEntry(text);
  if (entry) return <Term entry={entry}>{text}</Term>;
  return <strong className="key-term">{text}</strong>;
}

/** Renders inline `**key term**` markup. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <KeyPhrase key={i} text={p} /> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

/**
 * Bilingual note text.
 *  en   → English
 *  am   → Amharic
 *  both → English, with the Amharic explanation directly under it in a softer style
 * `single` forces one line (headings stay English in "both").
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
