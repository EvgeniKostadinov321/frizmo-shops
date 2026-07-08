import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";
import { RecentlyViewed } from "@/components/storefront/recently-viewed";
import { Paragraphs } from "@/components/storefront/sections/shared";
import { StockAlertForm } from "@/components/storefront/stock-alert-form";
import { VariantPicker } from "@/components/storefront/variant-picker";
import {
  getActiveProduct,
  getPublicCategories,
  getPublicShop,
  getRelatedProducts,
} from "@/db/queries/storefront";
import { publicImageUrl } from "@/lib/storage";

interface PageProps {
  params: Promise<{ slug: string; productSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  const product = await getActiveProduct(result.shop.id, productSlug);
  if (!product) return {};
  return {
    title: `${product.name} — ${result.shop.name}`,
    description: product.description.slice(0, 160) || product.name,
    openGraph: {
      title: product.name,
      ...(product.images[0] && { images: [publicImageUrl(product.images[0])] }),
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug, productSlug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop } = result;
  const base = `/s/${shop.slug}`;

  const product = await getActiveProduct(shop.id, productSlug);
  if (!product) notFound();

  const [related, categories] = await Promise.all([
    getRelatedProducts(shop.id, product.id, product.categoryId),
    getPublicCategories(shop.id),
  ]);
  const category = categories.find((c) => c.id === product.categoryId);

  const effectivePrice = product.promoPriceCents ?? product.priceCents;
  const inStock = product.stock === null || product.stock > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.description.slice(0, 500),
            ...(product.images[0] && { image: publicImageUrl(product.images[0]) }),
            offers: {
              "@type": "Offer",
              priceCurrency: "EUR",
              price: (effectivePrice / 100).toFixed(2),
              availability: inStock
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            },
          }),
        }}
      />

      <nav aria-label="Breadcrumbs" className="mb-6 text-sm text-(--sf-muted)">
        <Link href={base} className="hover:underline">
          Начало
        </Link>
        {" / "}
        {category ? (
          <>
            <Link href={`${base}/products?category=${category.id}`} className="hover:underline">
              {category.name}
            </Link>
            {" / "}
          </>
        ) : (
          <>
            <Link href={`${base}/products`} className="hover:underline">
              Продукти
            </Link>
            {" / "}
          </>
        )}
        <span className="text-(--sf-text)">{product.name}</span>
      </nav>

      <VariantPicker
        shopId={shop.id}
        productId={product.id}
        productName={product.name}
        basePriceCents={product.priceCents}
        promoPriceCents={product.promoPriceCents}
        baseStock={product.stock}
        images={product.images}
        options={product.options}
        variants={product.variants}
        category={
          category
            ? { name: category.name, href: `${base}/products?category=${category.id}` }
            : null
        }
        deal={
          product.promotion
            ? {
                quantity: product.promotion.quantity,
                totalPriceCents: product.promotion.totalPriceCents,
              }
            : null
        }
      />

      {/* S14: изчерпан продукт (следи наличност) → „извести ме" */}
      {product.stock === 0 && (
        <div className="mt-6 max-w-md">
          <StockAlertForm shopSlug={shop.slug} productId={product.id} />
        </div>
      )}

      {(product.description || product.attributes.length > 0) && (
        <div className="mt-14 grid gap-10 border-t border-(--sf-border) pt-10 md:grid-cols-2 md:gap-10">
          {product.description && (
            <div className="flex max-w-prose flex-col gap-3">
              <h2 className="text-2xl text-(--sf-text)">Описание</h2>
              <div className="flex flex-col gap-3 leading-relaxed text-(--sf-muted)">
                <Paragraphs text={product.description} />
              </div>
            </div>
          )}
          {product.attributes.length > 0 && (
            <div>
              <h2 className="mb-3 text-2xl text-(--sf-text)">Характеристики</h2>
              <dl className="divide-y divide-(--sf-border) rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised)">
                {product.attributes.map((attr) => (
                  <div key={attr.id} className="flex justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-(--sf-muted)">{attr.name}</dt>
                    <dd className="text-right font-medium text-(--sf-text)">{attr.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-14">
          <div className="mb-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary)">
              Разгледай още
            </p>
            <h2 className="text-2xl text-(--sf-text)">Още от магазина</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} base={base} />
            ))}
          </div>
        </div>
      )}

      <RecentlyViewed
        shopId={shop.id}
        slug={shop.slug}
        base={base}
        currentProductId={product.id}
      />

      {/* Въздух под съдържанието на мобилно — sticky CTA лентата е 64px + safe area. */}
      <div aria-hidden className="h-20 md:hidden" />
    </div>
  );
}
