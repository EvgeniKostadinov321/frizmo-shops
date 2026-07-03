import Image from "next/image";
import Link from "next/link";
import type { Shop } from "@/db";
import { Badge } from "@/components/ui";
import { publicImageUrl } from "@/lib/storage";

export function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Link
      href={`/s/${shop.slug}`}
      className="flex flex-col gap-3 rounded-card border border-surface-200 bg-surface-0 p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-float"
    >
      <div className="flex items-center gap-3">
        {shop.logoPath ? (
          <Image
            src={publicImageUrl(shop.logoPath)}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700"
          >
            {shop.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-bold text-ink-900">{shop.name}</p>
          {shop.city && <p className="text-xs text-ink-500">{shop.city}</p>}
        </div>
      </div>
      {shop.description && (
        <p className="line-clamp-2 text-sm text-ink-700">{shop.description}</p>
      )}
      <div className="mt-auto flex items-center justify-between">
        <Badge tone="brand">{shop.businessCategory}</Badge>
        <span className="text-sm font-medium text-brand-600">Разгледай →</span>
      </div>
    </Link>
  );
}
