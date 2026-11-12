"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { NotesLesson } from "@/lib/data";
import type { Locale } from "@/lib/locale";

/** Static skeleton (also the route's loading.tsx): same shape as the board, no React Flow needed. */
export function BoardSkeletonStatic() {
  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-20 bg-paper md:top-16" aria-busy="true" role="status">
      <span className="sr-only">Loading board</span>
      <div className="flex h-14 items-center gap-3 border-b border-line bg-surface px-3">
        <div className="skeleton size-9 rounded-xl" />
        <div className="skeleton h-5 w-48" />
      </div>
      <div className="relative h-full">
        {[
          [80, 60, 240, 150],
          [420, 120, 220, 170],
          [200, 320, 260, 140],
        ].map(([x, y, w, h], i) => (
          <div key={i} className="skeleton absolute rounded-2xl" style={{ left: x, top: y, width: w, height: h }} />
        ))}
      </div>
    </div>
  );
}

/** React Flow + the editor are only downloaded on board pages. */
const BoardEditor = dynamic(() => import("@/components/notes/board-editor"), { ssr: false, loading: () => <BoardSkeletonStatic /> });

/** Reads ?id= in the browser (keeps the page static), then shows the editor. */
export function BoardLoader(props: { locale: Locale; lessons: NotesLesson[] }) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setId(new URLSearchParams(window.location.search).get("id") ?? "");
  }, []);
  if (id === null) return <BoardSkeletonStatic />;
  return <BoardEditor key={id} boardId={id} {...props} />;
}
