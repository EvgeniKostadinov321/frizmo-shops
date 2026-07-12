import type { SupabaseClient } from "@supabase/supabase-js";

/** buyerId за поръчката: логнат купувач → неговото id; гост → null (както преди). */
export async function resolveBuyerId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
