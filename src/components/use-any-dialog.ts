"use client";

import { useEffect, useState } from "react";

/**
 * Is a bottom sheet / modal / full-screen sheet open anywhere on the page (the profile sheet, "Which board?",
 * the writing sheet, calculation paper…)? Watches the DOM, so every sheet counts without wiring each one up.
 * Only VISIBLE dialogs count (pages kept hidden by Next.js navigation have display: none).
 */
export function useAnyDialogOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const any = [...document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]')].some(
        (el) => el.getClientRects().length > 0,
      );
      setOpen(any);
    };
    const mo = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(check);
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["role", "aria-modal", "style", "class", "hidden"] });
    check();
    return () => {
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return open;
}
