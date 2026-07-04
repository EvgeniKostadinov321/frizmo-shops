import { desc, eq } from "drizzle-orm";
import { db, products } from "@/db";
import { WebsiteEditor } from "@/components/dashboard/website/editor";
import { getCategoriesTree } from "@/db/queries/categories";
import { getSiteSettingsRow, parseSiteSettings } from "@/db/queries/site-settings";
import { defaultSiteSettings } from "@/lib/sections";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Уебсайт — Frizmo Shops" };

export default async function WebsitePage() {
  const { shop } = await requireShop();

  const [row, tree, productRows] = await Promise.all([
    getSiteSettingsRow(shop.id),
    getCategoriesTree(shop.id),
    db.query.products.findMany({
      where: eq(products.shopId, shop.id),
      orderBy: [desc(products.createdAt)],
      limit: 100,
      columns: { id: true, name: true },
    }),
  ]);

  /* Продължаваме от draft-а, ако има незапазени промени от предишна сесия. */
  const raw = row?.draft ?? row?.settings;
  const initial = raw != null ? parseSiteSettings(raw, shop.name) : defaultSiteSettings(shop.name);

  const categoryOptions = tree.flatMap((root) => [
    { value: root.id, label: root.name },
    ...root.children.map((c) => ({ value: c.id, label: `${root.name} → ${c.name}` })),
  ]);
  const productOptions = productRows.map((p) => ({ value: p.id, label: p.name }));

  return (
    <WebsiteEditor
      shop={{
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        status: shop.status,
        logoPath: shop.logoPath,
      }}
      initial={initial}
      productOptions={productOptions}
      categoryOptions={categoryOptions}
    />
  );
}
