import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with the SECRET key. Bypasses RLS, so:
 * - server-only (this import throws if it ever reaches the browser),
 * - ONLY for auth-admin operations (ban, delete user, set password, rename login email),
 * - ONLY after requireAdmin() has passed (see src/lib/admin/auth.ts).
 * Never log or return the key.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Admin client is not configured");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
