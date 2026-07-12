import Image from "next/image";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, products } from "@/db";
import { WebsiteEditor } from "@/components/dashboard/website/editor";
import { WebsiteWizard } from "@/components/dashboard/website/wizard/wizard";
import { getCategoriesTree } from "@/db/queries/categories";
import { countProducts } from "@/db/queries/products";
import { getSiteSettingsRow, parseSiteSettings } from "@/db/queries/site-settings";
import { defaultSiteSettings } from "@/lib/sections";
import { requireShop } from "@/lib/auth";
import { flattenCategoryOptions } from "@/lib/category-tree";

export const metadata = { title: "Уебсайт — Frizmo Shops" };

interface PageProps {
  searchParams: Promise<{ wizard?: string }>;
}

export default async function WebsitePage({ searchParams }: PageProps) {
  const { shop } = await requireShop();
  const sp = await searchParams;

  /* Гейт: без поне един продукт сайтът няма смисъл (продуктовите секции са
     празни, публикуването е блокирано). Дружелюбна страница вместо редактор. */
  const productCount = await countProducts(shop.id);
  if (productCount === 0) {
    return (
      <div className="mx-auto flex h-full w-full max-w-xl flex-col items-center justify-center gap-5 overflow-y-auto px-4 py-10 text-center">
        <Image
          src="/bee-product.png"
          alt=""
          aria-hidden
          width={150}
          height={150}
          className="h-36 w-auto object-contain"
        />
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
            Първо добави продукт
          </h1>
          <p className="mx-auto mt-2 max-w-md text-ink-600">
            Сайтът ти се строи около продуктите — добави поне един и се връщай
            тук, за да направим витрината му за 5 минути.
          </p>
        </div>
        <Link
          href="/dashboard/products"
          className="inline-flex h-12 items-center justify-center rounded-control bg-ink-900 px-6 font-medium text-white transition-opacity hover:opacity-90"
        >
          Добави първия си продукт
        </Link>
      </div>
    );
  }

  const [row, tree, productRows] = await Promise.all([
    getSiteSettingsRow(shop.id),
    getCategoriesTree(shop.id),
    db.query.products.findMany({
      where: eq(products.shopId, shop.id),
      orderBy: [desc(products.createdAt)],
      limit: 100,
      columns: { id: true, name: true, slug: true },
    }),
  ]);
  /* Slug на най-новия продукт → preview таб „Продукт" сочи реална страница. */
  const sampleProductSlug = productRows[0]?.slug ?? null;

  /* Onboarding wizard: първо влизане (никога пипан сайт → няма ред) или
     изрично „Започни отначало" (?wizard=1). Резултатът пише в draft-а. */
  if (!row || sp.wizard === "1") {
    const existingCategories = (await getCategoriesTree(shop.id)).map((c) => c.name);
    return (
      <WebsiteWizard
        productCount={productCount}
        existingCategories={existingCategories}
        shop={{
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
          status: shop.status,
          description: shop.description ?? "",
          businessCategory: shop.businessCategory,
          logoPath: shop.logoPath,
        }}
      />
    );
  }

  /* Продължаваме от draft-а, ако има непубликувани промени от предишна сесия. */
  const raw = row?.draft ?? row?.settings;
  const initial = raw != null ? parseSiteSettings(raw, shop.name) : defaultSiteSettings(shop.name);
  const hasUnpublishedInitial = row?.draft != null;

  const categoryOptions = flattenCategoryOptions(tree);
  const productOptions = productRows.map((p) => ({ value: p.id, label: p.name }));

  const social = (shop.socialLinks as Record<string, string> | null) ?? {};
  const hasSocials = Object.values(social).some((v) => (v ?? "").trim() !== "");
  const hasAddress = Boolean(shop.address || shop.city);

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
      hasUnpublishedInitial={hasUnpublishedInitial}
      productOptions={productOptions}
      categoryOptions={categoryOptions}
      hasSocials={hasSocials}
      hasAddress={hasAddress}
      sampleProductSlug={sampleProductSlug}
    />
  );
}
