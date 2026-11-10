"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * One clean image card: the image fills the card width (16:10, cover, rounded) with the caption and
 * credit inside the card. If the image fails to load, the whole card is hidden instead of showing a broken box.
 */
export function LessonImage({
  src,
  alt,
  caption,
  credit,
}: {
  src: string;
  alt: string;
  caption?: React.ReactNode;
  credit: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <figure className="my-6 overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="relative aspect-[16/10] w-full bg-[var(--accent-tint)]">
        <Image
          src={src}
          alt={alt}
          fill
          loading="lazy"
          sizes="(min-width: 768px) 640px, 100vw"
          onError={() => setFailed(true)}
          className="object-cover"
        />
      </div>
      <figcaption className="px-4 py-3">
        {caption && <span className="block text-[15px] leading-snug text-ink/85">{caption}</span>}
        <span className="mt-1 block text-xs text-faint">{credit}</span>
      </figcaption>
    </figure>
  );
}
