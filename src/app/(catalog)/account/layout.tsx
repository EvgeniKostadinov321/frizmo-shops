import { eq } from "drizzle-orm";
import { AccountNav } from "@/components/account/account-nav";
import { db, shops } from "@/db";
import { requireBuyer } from "@/lib/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireBuyer();
  /* Ако купувачът е и продавач (owner на магазин) → показваме връзка към таблото
     на магазина в навигацията (граничният случай: логнат купувач иска да управлява
     магазина си, без да минава през storefront/marketing entry point). */
  const shop = await db.query.shops.findFirst({
    where: eq(shops.ownerId, user.id),
    columns: { id: true },
  });
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 md:flex-row md:gap-8 md:py-10">
      {/* Десктоп: вертикален sidebar вляво; мобилно: хоризонтални табове отгоре. */}
      <aside className="md:w-52 md:shrink-0">
        <AccountNav hasShop={Boolean(shop)} />
      </aside>
      <main className="min-w-0 flex-1 md:pt-1">{children}</main>
    </div>
  );
}
