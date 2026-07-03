import Image from "next/image";
import { Icon } from "@/components/ui";
import type { Product, Shop } from "@/db";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";

type PhoneMockupProps = {
  shop: Shop | null;
  products: Product[];
};

/* Fallback, ако демо магазинът липсва (празна база) — mockup-ът никога не е празен */
const FALLBACK = {
  name: "Ферма Зелена долина",
  city: "Троян",
  products: [
    { name: "Краве сирене", priceCents: 1250 },
    { name: "Планински мед", priceCents: 1590 },
    { name: "Домашен кашкавал", priceCents: 2300 },
  ],
};

/**
 * Телефон-витрина за hero-то: реално съдържание от демо магазина
 * (снимки от Storage, истински цени) вместо празни скелети.
 */
export function PhoneMockup({ shop, products }: PhoneMockupProps) {
  const name = shop?.name ?? FALLBACK.name;
  const city = shop?.city ?? FALLBACK.city;
  const items = products.length
    ? products.slice(0, 3).map((p) => ({
        name: p.name,
        priceCents: p.promoPriceCents ?? p.priceCents,
        image: p.images[0] ? publicImageUrl(p.images[0]) : null,
      }))
    : FALLBACK.products.map((p) => ({ ...p, image: null }));
  const gallery = products.flatMap((p) => p.images).slice(0, 3);

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-xs">
      {/* Рамка на телефона */}
      <div className="overflow-hidden rounded-[2.6rem] border-10 border-ink-900 bg-surface-0 shadow-float">
        {/* Динамичен остров */}
        <div className="flex justify-center bg-surface-0 pt-2.5">
          <span className="h-5 w-24 rounded-full bg-ink-900" />
        </div>

        {/* Витрина */}
        <div className="px-4 pb-4 pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-extrabold leading-tight text-ink-900">
                {name}
              </p>
              <p className="text-[10px] text-ink-500">{city} · отворено днес</p>
            </div>
            <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[9px] font-bold text-white">
              Поръчай
            </span>
          </div>

          <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.22em] text-ink-500">
            Продукти
          </p>
          <div className="mt-1.5 flex flex-col">
            {items.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-2.5 border-t border-surface-100 py-2 first:border-t-0"
              >
                {item.image ? (
                  <Image
                    src={item.image}
                    alt=""
                    width={36}
                    height={36}
                    className="size-9 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon name="store" size={15} />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink-900">
                  {item.name}
                </span>
                <span className="shrink-0 text-[11px] font-bold text-ink-900">
                  {formatPrice(item.priceCents)}
                </span>
              </div>
            ))}
          </div>

          {gallery.length >= 3 && (
            <>
              <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.22em] text-ink-500">
                Галерия
              </p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {gallery.map((path) => (
                  <Image
                    key={path}
                    src={publicImageUrl(path)}
                    alt=""
                    width={90}
                    height={90}
                    className="aspect-square rounded-lg object-cover"
                  />
                ))}
              </div>
            </>
          )}

          {/* Отзив */}
          <div className="mt-3 rounded-xl bg-surface-50 p-3">
            <p className="text-[9px] tracking-widest text-ember-500">★★★★★</p>
            <p className="mt-1 text-[10px] leading-snug text-ink-700">
              „Поръчах вечерта, на другия ден беше при мен. Все едно съм на пазара.“
            </p>
          </div>
        </div>
      </div>

      {/* Плаващо известие — това получава търговецът */}
      <div className="absolute -bottom-5 -left-6 flex items-center gap-2.5 rounded-2xl border border-surface-200 bg-surface-0 p-3 shadow-float sm:-left-12">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Icon name="bell" size={17} />
        </span>
        <span>
          <span className="block text-xs font-bold text-ink-900">Нова поръчка</span>
          <span className="block text-[10px] text-ink-500">Мария К. · преди 3 минути</span>
        </span>
      </div>
    </div>
  );
}
