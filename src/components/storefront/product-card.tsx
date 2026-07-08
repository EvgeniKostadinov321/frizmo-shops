import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { FavoriteButton } from "@/components/storefront/favorite-button";
import { Stars } from "@/components/storefront/stars";
import type { Product } from "@/db";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";

/** Процент отстъпка за промо badge-а (закръглен). */
export function discountPercent(priceCents: number, promoCents: number): number {
  return Math.round((1 - promoCents / priceCents) * 100);
}

export function ProductCard({
  product,
  base,
  ratio = "portrait",
  rating,
}: {
  product: Product;
  base: string;
  /** portrait = 4:5 (стандарт); square = 1:1 (компактни композиции, напр. 2×2). */
  ratio?: "portrait" | "square";
  /** S1: агрегат от approved ревюта (подава се от листинга; null/пропуснат = без звезди). */
  rating?: { avg: number; count: number } | null;
}) {
  const cover = product.images[0];
  const hoverImage = product.images[1];
  const outOfStock = product.stock !== null && product.stock <= 0;
  /* Промо е валидно само ако реално е под редовната цена — иначе баджът показва
     „−0%" / отрицателно (търговец е сложил промо ≥ цена по грешка). */
  const promo =
    product.promoPriceCents !== null && product.promoPriceCents < product.priceCents
      ? product.promoPriceCents
      : null;

  return (
    <Link
      href={`${base}/p/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) shadow-(--sf-shadow) transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-(--sf-shadow-hover)"
    >
      {/* Image-first: hover zoom + втора снимка при наличие */}
      <span
        className={`sf-frame relative w-full overflow-hidden bg-(--sf-surface) ${
          ratio === "square" ? "aspect-square" : "aspect-4/5"
        }`}
      >
        {cover ? (
          <>
            <Image
              src={publicImageUrl(cover)}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className={`object-cover transition-all duration-500 group-hover:scale-[1.04] ${
                hoverImage ? "group-hover:opacity-0" : ""
              }`}
            />
            {hoverImage && (
              <Image
                src={publicImageUrl(hoverImage)}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover opacity-0 transition-all duration-500 group-hover:scale-[1.04] group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <span className="flex size-full items-center justify-center" aria-hidden>
            <Icon name="image" size={40} className="text-(--sf-muted) opacity-40" />
          </span>
        )}
        {promo !== null && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-(--sf-accent) px-2.5 py-1 text-xs font-bold text-(--sf-on-accent)">
            −{discountPercent(product.priceCents, promo)}%
          </span>
        )}
        <FavoriteButton shopId={product.shopId} productId={product.id} variant="card" />
        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-(--sf-text)/85 py-1.5 text-center text-xs font-medium text-(--sf-bg)">
            Изчерпано
          </span>
        )}
      </span>
      {/* Име на чист ред, цената отдолу — не се чупи при тесни карти */}
      <span className="flex flex-1 flex-col gap-0.5 px-4 py-3">
        <span className="truncate font-medium leading-snug text-(--sf-text)" title={product.name}>
          {product.name}
        </span>
        {rating && rating.count > 0 && (
          <span className="flex items-center gap-1.5 text-(--sf-primary)">
            <Stars rating={rating.avg} size={13} />
            <span className="text-xs text-(--sf-muted)">({rating.count})</span>
          </span>
        )}
        <span className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-(--sf-text)">
            {formatPrice(promo ?? product.priceCents)}
          </span>
          {promo !== null && (
            <s className="text-sm text-(--sf-muted)">{formatPrice(product.priceCents)}</s>
          )}
        </span>
      </span>
    </Link>
  );
}
