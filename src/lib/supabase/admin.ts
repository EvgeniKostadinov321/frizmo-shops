import "server-only";
import { createClient } from "@supabase/supabase-js";

/** САМО за Storage операции. Secret key — никога не изтича към клиента. */
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
