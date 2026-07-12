import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";
import { ProductDelivery } from "@/components/storefront/product-delivery";
import { RecentlyViewed } from "@/components/storefront/recently-viewed";
import { Paragraphs } from "@/components/storefront/sections/shared";
import { ReviewForm } from "@/components/storefront/review-form";
import { Icon } from "@/components/ui";
import { Stars } from "@/components/storefront/stars";
import { StockAlertForm } from "@/components/storefront/stock-alert-form";
import { getShippingMethods } from "@/db/queries/fulfillment";
import { getApprovedReviews, getReviewAggregates } from "@/db/queries/reviews";
import { getAnsweredQuestions } from "@/db/queries/questions";
import { getSizeGuide } from "@/db/queries/size-guides";
import { SizeGuideModal } from "@/components/storefront/size-guide-modal";
import { QuestionForm } from "@/components/storefront/question-form";
import { VariantPicker } from "@/components/storefront/variant-picker";
import {
  getActiveProduct,
  getPublicCategories,
  getPublicShop,
  getRelatedProducts,
  getSoldCount,
} from "@/db/queries/storefront";
import { publicImageUrl } from "@/lib/storage";
import { jsonLdHtml } from "@/lib/json-ld";
import { buildProductJsonLd } from "@/lib/product-json-ld";
import { formatNetQuantity } from "@/lib/money";
import { count, NOUNS } from "@/lib/plural";

interface PageProps {
  params: Promise<{ slug: string; productSlug: string }>;
  searchParams: Promise<{ reviewsPage?: string; questionsPage?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  const product = await getActiveProduct(result.shop.id, productSlug);
  if (!product) return {};
  return {
    title: product.seoTitle || `${product.name} — ${result.shop.name}`,
    description:
      product.seoDescription || product.description.slice(0, 160) || product.name,
    alternates: { canonical: `/s/${slug}/p/${productSlug}` },
    openGraph: {
      title: product.seoTitle || product.name,
      ...(product.images[0] && { images: [publicImageUrl(product.images[0])] }),
    },
  };
}

export default async function ProductPage({ params, searchParams }: PageProps) {
  const { slug, productSlug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop } = result;
  const base = `/s/${shop.slug}`;

  const product = await getActiveProduct(shop.id, productSlug);
  if (!product) notFound();

  const sp = await searchParams;
  const reviewsPage = sp.reviewsPage ? Math.max(1, Number(sp.reviewsPage) || 1) : 1;
  const questionsPage = sp.questionsPage ? Math.max(1, Number(sp.questionsPage) || 1) : 1;
  const [related, categories, productReviews, aggregates, shipping, soldCount, questions] =
    await Promise.all([
      getRelatedProducts(shop.id, product.id, product.categoryId),
      getPublicCategories(shop.id),
      getApprovedReviews(product.id, reviewsPage),
      getReviewAggregates([product.id]),
      getShippingMethods(shop.id),
      getSoldCount(shop.id, product.id),
      getAnsweredQuestions(product.id, questionsPage),
    ]);
  const activeShipping = shipping.filter((m) => m.active);
  const rating = aggregates.get(product.id) ?? null;
  const category = categories.find((c) => c.id === product.categoryId);
  const sizeGuide = product.sizeGuideId
    ? await getSizeGuide(shop.id, product.sizeGuideId)
    : null;

  const effectivePrice = product.promoPriceCents ?? product.priceCents;
  const inStock = product.stock === null || product.stock > 0;

  /* priceValidUntil ~1 година напред (Google предупреждава за offers без нея).
     Смята се тук (server), не в чистата функция (без new Date в тестван модул). */
  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);
  const priceValidUntil = validUntil.toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            buildProductJsonLd({
              name: product.name,
              description: product.description,
              image: product.images[0] ? publicImageUrl(product.images[0]) : undefined,
              priceEur: (effectivePrice / 100).toFixed(2),
              availability: inStock ? "InStock" : "OutOfStock",
              brandName: product.brand || shop.name,
              sku: product.sku || undefined,
              gtin: product.gtin || undefined,
              ratingValue: rating ? rating.avg.toFixed(1) : undefined,
              ratingCount: rating ? rating.count : undefined,
              weightGrams: product.weightGrams ?? undefined,
              priceValidUntil,
            }),
          ),
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
        sidebar={
          <>
            {(product.brand || soldCount >= 5 || sizeGuide) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-(--sf-border) pt-4 text-sm text-(--sf-muted)">
                {product.brand && (
                  <span>
                    Марка: <span className="text-(--sf-text)">{product.brand}</span>
                  </span>
                )}
                {soldCount >= 5 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="shopping-cart" size={15} />
                    {count(soldCount, NOUNS.sold)}
                  </span>
                )}
                {sizeGuide && (
                  <SizeGuideModal
                    name={sizeGuide.name}
                    columns={sizeGuide.columns}
                    rows={sizeGuide.rows}
                  />
                )}
              </div>
            )}

            {/* S14: изчерпан продукт (следи наличност) → „извести ме" */}
            {product.stock === 0 && (
              <StockAlertForm shopSlug={shop.slug} productId={product.id} />
            )}

            <ProductDelivery methods={activeShipping} />
          </>
        }
      />

      {(product.description ||
        product.attributes.length > 0 ||
        product.netQuantityValue !== null) && (
        <div className="mt-14 grid gap-10 border-t border-(--sf-border) pt-10 md:grid-cols-2 md:gap-10">
          {product.description && (
            <div className="flex max-w-prose flex-col gap-3">
              <h2 className="text-2xl text-(--sf-text)">Описание</h2>
              <div className="flex flex-col gap-3 leading-relaxed text-(--sf-muted)">
                <Paragraphs text={product.description} />
              </div>
            </div>
          )}
          {(product.attributes.length > 0 || product.netQuantityValue !== null) && (
            <div>
              <h2 className="mb-3 text-2xl text-(--sf-text)">Характеристики</h2>
              <dl className="divide-y divide-(--sf-border) rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised)">
                {product.netQuantityValue !== null && (
                  <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-(--sf-muted)">Количество</dt>
                    <dd className="text-right font-medium text-(--sf-text)">
                      {formatNetQuantity(product.netQuantityValue, product.netQuantityUnit ?? "g")}
                    </dd>
                  </div>
                )}
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

      {/* S1: ревюта — само approved се виждат; формата подава pending */}
      <div className="mt-14 border-t border-(--sf-border) pt-10">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <h2 className="text-2xl text-(--sf-text)">Ревюта</h2>
          {rating && (
            <span className="flex items-center gap-2 text-(--sf-primary)">
              <Stars rating={rating.avg} size={18} />
              <span className="text-sm font-medium text-(--sf-text)">
                {rating.avg.toFixed(1)} · {rating.count} {rating.count === 1 ? "ревю" : "ревюта"}
              </span>
            </span>
          )}
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            {productReviews.items.length === 0 ? (
              <p className="text-sm text-(--sf-muted)">
                Още няма ревюта — бъди първият, който ще сподели мнение.
              </p>
            ) : (
              <>
                <ul className="flex flex-col divide-y divide-(--sf-border)">
                  {productReviews.items.map((review) => (
                    <li key={review.id} className="flex flex-col gap-1.5 py-4 first:pt-0">
                      <div className="flex items-center gap-2">
                        <span className="text-(--sf-primary)">
                          <Stars rating={review.rating} size={14} />
                        </span>
                        <span className="font-medium text-(--sf-text)">{review.authorName}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--sf-muted)">
                        {review.verified && (
                          <span className="inline-flex items-center gap-1 font-medium text-(--sf-primary)">
                            <Icon name="shield-check" size={13} />
                            Потвърдена покупка
                          </span>
                        )}
                        <span>
                          {new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "short", year: "numeric" }).format(review.createdAt)}
                        </span>
                      </div>
                      {review.text && (
                        <p className="text-sm leading-relaxed text-(--sf-muted)">{review.text}</p>
                      )}
                    </li>
                  ))}
                </ul>
                {productReviews.total > reviewsPage * productReviews.pageSize && (
                  <Link
                    href={`${base}/p/${product.slug}?reviewsPage=${reviewsPage + 1}`}
                    className="self-start text-sm font-medium text-(--sf-primary) hover:underline"
                  >
                    Виж още ревюта →
                  </Link>
                )}
              </>
            )}
          </div>
          <ReviewForm shopSlug={shop.slug} productId={product.id} />
        </div>
      </div>

      {/* Q&A — само отговорени въпроси се виждат; формата подава pending */}
      <div className="mt-14 border-t border-(--sf-border) pt-10">
        <h2 className="mb-6 text-2xl text-(--sf-text)">Въпроси и отговори</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            {questions.items.length === 0 ? (
              <p className="text-sm text-(--sf-muted)">Още няма въпроси — задай първия.</p>
            ) : (
              <>
                <ul className="flex flex-col divide-y divide-(--sf-border)">
                  {questions.items.map((q) => (
                    <li key={q.id} className="flex flex-col gap-2 py-4 first:pt-0">
                      <div className="flex items-baseline gap-2">
                        <Icon name="help-circle" size={15} className="shrink-0 text-(--sf-primary)" />
                        <p className="font-medium text-(--sf-text)">{q.question}</p>
                      </div>
                      <p className="pl-6 text-xs text-(--sf-muted)">
                        {q.askerName || "Купувач"} ·{" "}
                        {new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "short", year: "numeric" }).format(q.createdAt)}
                      </p>
                      <div className="ml-6 border-l-2 border-(--sf-border) pl-3">
                        <p className="text-sm leading-relaxed text-(--sf-muted)">{q.answer}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {questions.total > questionsPage * questions.pageSize && (
                  <Link
                    href={`${base}/p/${product.slug}?questionsPage=${questionsPage + 1}`}
                    className="self-start text-sm font-medium text-(--sf-primary) hover:underline"
                  >
                    Виж още въпроси →
                  </Link>
                )}
              </>
            )}
          </div>
          <QuestionForm shopSlug={shop.slug} productId={product.id} />
        </div>
      </div>

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
