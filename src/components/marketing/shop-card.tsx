import Image from "next/image";
import Link from "next/link";
import type { Shop } from "@/db";
import { Icon } from "@/components/ui";
import { publicImageUrl } from "@/lib/storage";

type ShopCardProps = {
  shop: Shop;
  /** Cover снимка (първи продукт); при липса — топъл градиент по нишата. */
  coverImage?: string | null;
};

/** Топъл градиент-фон по бизнес категорията, когато няма cover снимка. */
function categoryGradient(category: string): string {
  const key = category.toLowerCase();
  if (key.includes("храни")) return "from-brand-100 to-ember-500/25";
  if (key.includes("козметика")) return "from-danger-600/15 to-ember-500/20";
  return "from-brand-100 to-brand-500/20"; // ръчна изработка / по подразбиране
}

export function ShopCard({ shop, coverImage }: ShopCardProps) {
  return (
    <Link
      href={`/s/${shop.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-surface-200 bg-surface-0 shadow-card transition-all hover:-translate-y-1 hover:border-surface-300 hover:shadow-float"
    >
      {/* Cover — снимка или градиент по нишата, с логото/инициала долу вляво */}
      <div className="relative h-40 overflow-hidden">
        {coverImage ? (
          <Image
            src={coverImage}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden
            className={`flex size-full items-center justify-center bg-linear-to-br ${categoryGradient(shop.businessCategory)}`}
          >
            <Icon name="store" size={40} className="text-brand-600/40" />
          </div>
        )}
        {/* Scrim долу — четимост на аватара/бранда върху всяка снимка */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-ink-900/55 to-transparent"
        />
        {/* Category badge горе вдясно */}
        <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-surface-0/90 px-2.5 py-0.5 text-xs font-semibold text-ink-900 shadow-sm backdrop-blur">
          {shop.businessCategory}
        </span>
        {/* Лого + име долу вляво върху scrim-а */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 p-4">
          {shop.logoPath ? (
            <Image
              src={publicImageUrl(shop.logoPath)}
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-xl border-2 border-white/80 object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-white/80 bg-brand-600 text-base font-bold text-white"
            >
              {shop.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{shop.name}</p>
            {shop.city && <p className="truncate text-xs text-white/80">{shop.city}</p>}
          </div>
        </div>
      </div>

      {/* Тяло — описание + CTA */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        {shop.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-ink-700">{shop.description}</p>
        )}
        <span className="mt-auto flex items-center gap-1 pt-1 text-sm font-semibold text-brand-600">
          Разгледай магазина
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}
