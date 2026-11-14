import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time comparison of a header against a secret (both hashed first, so lengths always match). */
export function secretMatches(got: string | null, expected: string | undefined): boolean {
  if (!got || !expected) return false;
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
