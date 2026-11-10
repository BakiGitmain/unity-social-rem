import "server-only";

/**
 * Simple per-IP burst limit: at most `max` requests per `windowMs`.
 * In memory, so it is per server instance (best effort). The real daily limit lives in Supabase.
 */
const hits = new Map<string, number[]>();

export function burstLimited(ip: string, max = 5, windowMs = 10_000): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);

  // Keep the map small.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return false;
}
