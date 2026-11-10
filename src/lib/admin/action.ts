import "server-only";
import { revalidatePath } from "next/cache";
import { AdminDenied, requireAdmin, type AdminContext } from "@/lib/admin/auth";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Wraps every admin server action: checks admin + 2FA FIRST (layer 3), then runs `fn`.
 * Errors become { ok: false } with a safe message (no stack traces, no secrets).
 * After a successful WRITE, every admin page is revalidated: the action's response already carries the fresh
 * data for the current page (lists, counts, KPIs update without a reload), and other admin pages are fresh
 * when opened. Read-only actions pass { revalidate: false }.
 */
export async function adminAction<T>(fn: (ctx: AdminContext) => Promise<T>, opts: { revalidate?: boolean } = {}): Promise<ActionResult<T>> {
  let ctx: AdminContext;
  try {
    ctx = await requireAdmin();
  } catch {
    return { ok: false, error: "Not found" };
  }
  try {
    const data = await fn(ctx);
    if (opts.revalidate !== false) revalidatePath("/admin", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof AdminDenied) return { ok: false, error: "Not found" };
    const msg = e instanceof Error ? e.message : "Something went wrong";
    return { ok: false, error: msg.slice(0, 300) };
  }
}

/** Throw inside an action for a user-facing error. */
export function fail(message: string): never {
  throw new Error(message);
}
