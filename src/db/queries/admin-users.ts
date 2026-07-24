import "server-only";
import { inArray } from "drizzle-orm";
import { db, profiles, shops } from "@/db";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ADMIN_USERS_PAGE_SIZE = 30;

export interface AdminUserRow {
  id: string;
  email: string;
  provider: string | null;
  confirmed: boolean;
  lastSignInAt: Date | null;
  createdAt: Date;
  fullName: string | null;
  role: string | null;
  shopCount: number;
}

/**
 * Списък акаунти за супер-админ (read-only). auth.users не е в Drizzle схемата →
 * идва през Supabase Admin API (server-only, SUPABASE_SECRET_KEY). Обогатява се с
 * profiles (име/роля) + брой магазини по owner. Пагинация през listUsers page.
 */
export async function getAdminUsers(page = 1) {
  const safePage = Math.max(1, page);
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.auth.admin.listUsers({
    page: safePage,
    perPage: ADMIN_USERS_PAGE_SIZE,
  });
  if (error || !data) {
    return { items: [] as AdminUserRow[], total: 0, page: safePage, pageSize: ADMIN_USERS_PAGE_SIZE };
  }

  const ids = data.users.map((u) => u.id);
  const [profRows, shopRows] = await Promise.all([
    ids.length
      ? db
          .select({ id: profiles.id, fullName: profiles.fullName, preferredRole: profiles.preferredRole })
          .from(profiles)
          .where(inArray(profiles.id, ids))
      : Promise.resolve([]),
    ids.length
      ? db.select({ ownerId: shops.ownerId }).from(shops).where(inArray(shops.ownerId, ids))
      : Promise.resolve([]),
  ]);

  const profMap = new Map(profRows.map((p) => [p.id, p]));
  const shopCount = new Map<string, number>();
  for (const s of shopRows) shopCount.set(s.ownerId, (shopCount.get(s.ownerId) ?? 0) + 1);

  const items: AdminUserRow[] = data.users.map((u) => ({
    id: u.id,
    email: u.email ?? "—",
    provider: (u.app_metadata?.provider as string | undefined) ?? null,
    confirmed: Boolean(u.email_confirmed_at),
    lastSignInAt: u.last_sign_in_at ? new Date(u.last_sign_in_at) : null,
    createdAt: new Date(u.created_at),
    fullName: profMap.get(u.id)?.fullName || null,
    role: (profMap.get(u.id)?.preferredRole as string | null) ?? null,
    shopCount: shopCount.get(u.id) ?? 0,
  }));

  /* listUsers връща `total` в новите версии; fallback на дължината на страницата. */
  const total = (data as unknown as { total?: number }).total ?? items.length;
  return { items, total, page: safePage, pageSize: ADMIN_USERS_PAGE_SIZE };
}
