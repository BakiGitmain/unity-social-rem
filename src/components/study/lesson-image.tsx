"use client";

import { useState } from "react";
import Image from "next/image";

/** Lazy lesson image. If it fails to load, the whole figure is hidden instead of showing a broken box. */
export function LessonImage({
  src,
  alt,
  width,
  height,
  children,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <figure className="my-6">
      <div className="overflow-hidden rounded-xl border border-line bg-[var(--accent-tint)]">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          sizes="(min-width: 1024px) 640px, 100vw"
          onError={() => setFailed(true)}
          className="mx-auto h-auto max-h-[22rem] w-auto max-w-full object-contain"
        />
      </div>
      {children}
    </figure>
  );
}
