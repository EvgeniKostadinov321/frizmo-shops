import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui";
import type { CatalogProduct } from "@/db/queries/catalog";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";

export function CatalogProductCard({ product }: { product: CatalogProduct }) {
  const cover = product.images[0];
  return (
    <Link
      href={`/s/${product.shopSlug}/p/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-surface-200 bg-surface-0 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md"
    >
      <span className="relative aspect-square w-full bg-surface-50">
        {cover ? (
          <Image
            src={publicImageUrl(cover)}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-surface-300">
            <Icon name="image" size={40} />
          </span>
        )}
        {product.promoPriceCents !== null && (
          <span className="absolute left-2 top-2 rounded-full bg-warning-600 px-2 py-0.5 text-xs font-bold text-white">
            Промо
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-3">
        <span className="line-clamp-2 text-sm font-medium text-ink-900">{product.name}</span>
        <span className="text-xs text-ink-500">{product.shopName}</span>
        <span className="mt-auto font-bold text-brand-600">
          {product.promoPriceCents !== null ? (
            <>
              {formatPrice(product.promoPriceCents)}{" "}
              <s className="text-xs font-normal text-ink-500">
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
