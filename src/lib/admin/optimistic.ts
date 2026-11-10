/**
 * Pure list updates used for optimistic UI (React useOptimistic): the change shows at once, the server confirms,
 * and on failure React drops the optimistic state (= automatic rollback). Tested in optimistic.test.ts.
 */
type WithId = { id: string };

export function removeIds<T extends WithId>(rows: T[], ids: string[]): T[] {
  const set = new Set(ids);
  return rows.filter((r) => !set.has(r.id));
}

/** Replace the row with the same id, or add it (at the start) if it's new. */
export function upsertRow<T extends WithId>(rows: T[], row: T): T[] {
  const i = rows.findIndex((r) => r.id === row.id);
  if (i === -1) return [row, ...rows];
  const next = rows.slice();
  next[i] = { ...rows[i]!, ...row };
  return next;
}

export function patchIds<T extends WithId>(rows: T[], ids: string[], patch: Partial<T>): T[] {
  const set = new Set(ids);
  return rows.map((r) => (set.has(r.id) ? { ...r, ...patch } : r));
}

/* ---------------- users ---------------- */

export type UserRowLike = WithId & { banned: boolean; banned_until: string | null; role: string; username: string; ai_daily_limit: number | null };

export type UserChange =
  | { type: "delete"; ids: string[] }
  | { type: "ban"; ids: string[]; until: string }
  | { type: "unban"; ids: string[] }
  | { type: "patch"; id: string; patch: Partial<UserRowLike> };

export function applyUserChange<T extends UserRowLike>(rows: T[], c: UserChange): T[] {
  switch (c.type) {
    case "delete":
      return removeIds(rows, c.ids);
    case "ban":
      return patchIds(rows, c.ids, { banned: true, banned_until: c.until } as Partial<T>);
    case "unban":
      return patchIds(rows, c.ids, { banned: false, banned_until: null } as Partial<T>);
    case "patch":
      return patchIds(rows, [c.id], c.patch as Partial<T>);
  }
}

/** Generic list change for announcements, schedule entries, overrides, feedback… */
export type ListChange<T extends WithId> = { type: "delete"; ids: string[] } | { type: "upsert"; row: T } | { type: "patch"; ids: string[]; patch: Partial<T> };

export function applyListChange<T extends WithId>(rows: T[], c: ListChange<T>): T[] {
  if (c.type === "delete") return removeIds(rows, c.ids);
  if (c.type === "upsert") return upsertRow(rows, c.row);
  return patchIds(rows, c.ids, c.patch);
}
