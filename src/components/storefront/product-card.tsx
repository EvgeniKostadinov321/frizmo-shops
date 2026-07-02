import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/db";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";

export function ProductCard({ product, base }: { product: Product; base: string }) {
  const cover = product.images[0];
  const outOfStock = product.stock !== null && product.stock <= 0;

  return (
    <Link
      href={`${base}/p/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) transition-shadow hover:shadow-md"
    >
      <span className="relative aspect-square w-full bg-(--sf-bg)">
        {cover ? (
          <Image
            src={publicImageUrl(cover)}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-4xl" aria-hidden>
            📦
          </span>
        )}
        {product.promoPriceCents !== null && (
          <span className="absolute left-2 top-2 rounded-full bg-(--sf-accent) px-2 py-0.5 text-xs font-bold text-white">
            Промо
          </span>
        )}
        {outOfStock && (
          <span className="absolute right-2 top-2 rounded-full bg-(--sf-text) px-2 py-0.5 text-xs font-medium text-(--sf-bg)">
            Изчерпано
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-3">
        <span className="line-clamp-2 text-sm font-medium text-(--sf-text)">{product.name}</span>
        <span className="mt-auto text-base font-bold text-(--sf-primary)">
          {product.promoPriceCents !== null ? (
            <>
              {formatPrice(product.promoPriceCents)}{" "}
              <s className="text-xs font-normal text-(--sf-muted)">
                {formatPrice(product.priceCents)}
              </s>
            </>
          ) : (
            formatPrice(product.priceCents)
          )}
        </span>
      </span>
    </Link>
  );
}
