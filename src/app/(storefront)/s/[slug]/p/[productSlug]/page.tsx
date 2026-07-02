import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";
import { Paragraphs } from "@/components/storefront/sections/shared";
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

      <h1
        className="mb-6 text-3xl text-(--sf-text)"
      >
        {product.name}
      </h1>

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
        deal={
          product.promotion
            ? {
                quantity: product.promotion.quantity,
                totalPriceCents: product.promotion.totalPriceCents,
              }
            : null
        }
      />

      {product.description && (
        <div className="mt-10 flex max-w-prose flex-col gap-3 text-(--sf-muted)">
          <h2
            className="text-xl text-(--sf-text)"
          >
            Описание
          </h2>
          <Paragraphs text={product.description} />
        </div>
      )}

      {product.attributes.length > 0 && (
        <div className="mt-8 max-w-prose">
          <h2
            className="mb-3 text-xl text-(--sf-text)"
          >
            Характеристики
          </h2>
          <dl className="divide-y divide-(--sf-border) rounded-(--sf-radius) border border-(--sf-border)">
            {product.attributes.map((attr) => (
              <div key={attr.id} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <dt className="text-(--sf-muted)">{attr.name}</dt>
                <dd className="font-medium text-(--sf-text)">{attr.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-12">
          <h2
            className="mb-4 text-xl text-(--sf-text)"
          >
            Още от магазина
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} base={base} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
