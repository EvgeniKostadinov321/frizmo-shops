import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui";
import type { Product } from "@/db";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";
import type { SectionOfType } from "@/schemas/site-settings";
import { Carousel } from "../carousel";
import { ProductCard } from "../product-card";
import { SectionShell, type SectionTone } from "./shared";
import type { SectionContext } from "./index";

interface FeaturedProductsProps {
  data: SectionOfType<"featured-products">["data"];
  products: Product[];
  ctx: SectionContext;
  tone?: SectionTone;
}

/** 1 продукт → spotlight: голяма снимка + продуктов панел (мини product page). */
function Spotlight({ product, base }: { product: Product; base: string }) {
  const cover = product.images[0];
  const promo = product.promoPriceCents;
  return (
    <Link
      href={`${base}/p/${product.slug}`}
      className="group grid overflow-hidden rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) shadow-(--sf-shadow) md:grid-cols-[3fr_2fr]"
    >
      <span className="relative aspect-4/3 overflow-hidden bg-(--sf-surface) md:aspect-auto md:min-h-96">
        {cover ? (
          <Image
            src={publicImageUrl(cover)}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex size-full items-center justify-center" aria-hidden>
            <Icon name="image" size={56} className="text-(--sf-muted) opacity-40" />
          </span>
        )}
      </span>
      <span className="flex flex-col justify-center gap-4 p-8 sm:p-10">
        <span className="text-2xl leading-snug text-(--sf-text) sm:text-3xl">{product.name}</span>
        {product.description && (
          <span className="line-clamp-3 leading-relaxed text-(--sf-muted)">
            {product.description}
          </span>
        )}
        <span className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-(--sf-text)">
            {formatPrice(promo ?? product.priceCents)}
          </span>
          {promo !== null && (
            <s className="text-lg text-(--sf-muted)">{formatPrice(product.priceCents)}</s>
          )}
        </span>
        <span className="mt-2 inline-flex h-12 w-fit items-center rounded-(--sf-radius) bg-(--sf-primary) px-7 font-medium text-(--sf-on-primary) transition-opacity group-hover:opacity-90">
          Виж продукта
        </span>
      </span>
    </Link>
  );
}

/** Голямата карта в асиметричния grid — снимката пълни височината на реда. */
function LargeCard({ product, base }: { product: Product; base: string }) {
  const cover = product.images[0];
  const promo = product.promoPriceCents;
  return (
    <Link
      href={`${base}/p/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) shadow-(--sf-shadow) transition-transform duration-300 hover:-translate-y-0.5"
    >
      <span className="relative min-h-72 flex-1 overflow-hidden bg-(--sf-surface)">
        {cover ? (
          <Image
            src={publicImageUrl(cover)}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex size-full items-center justify-center" aria-hidden>
            <Icon name="image" size={56} className="text-(--sf-muted) opacity-40" />
          </span>
        )}
        {promo !== null && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-(--sf-accent) px-2.5 py-1 text-xs font-bold text-(--sf-on-accent)">
            Промо
          </span>
        )}
      </span>
      <span className="flex items-baseline justify-between gap-3 p-5">
        <span className="line-clamp-2 text-xl leading-snug text-(--sf-text)">{product.name}</span>
        <span className="flex shrink-0 items-baseline gap-2">
          {promo !== null && (
            <s className="text-sm text-(--sf-muted)">{formatPrice(product.priceCents)}</s>
          )}
          <span className="text-xl font-bold text-(--sf-text)">
            {formatPrice(promo ?? product.priceCents)}
          </span>
        </span>
      </span>
    </Link>
  );
}

export function FeaturedProductsSection({ data, products, ctx, tone }: FeaturedProductsProps) {
  if (products.length === 0) return null;
  const count = products.length;

  const action = (
    <Link href={`${ctx.base}/products`} className="font-medium text-(--sf-primary) hover:opacity-75">
      Виж всички →
    </Link>
  );

  /* Адаптивно по брой:
     1 → spotlight · 5 → асиметрия (голяма + 2×2 — балансът е идеален точно
     при 5; „висящият пети" става нарочна композиция) · 2/3/4/6 → равни
     редове · 7+ → карусел. */
  let body: React.ReactNode;
  if (count === 1) {
    body = <Spotlight product={products[0]!} base={ctx.base} />;
  } else if (count === 5) {
    const [first, ...rest] = products;
    body = (
      <div className="grid gap-4 md:grid-cols-2">
        <LargeCard product={first!} base={ctx.base} />
        <div className="grid grid-cols-2 gap-4">
          {rest.map((p) => (
            <ProductCard key={p.id} product={p} base={ctx.base} />
          ))}
        </div>
      </div>
    );
  } else if (count <= 6) {
    const cols =
      count === 2
        ? "sm:grid-cols-2"
        : count === 3
          ? "sm:grid-cols-3"
          : count === 4
            ? "sm:grid-cols-2 lg:grid-cols-4"
            : "sm:grid-cols-2 lg:grid-cols-3";
    body = (
      <div className={`grid grid-cols-2 gap-4 ${cols}`}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} base={ctx.base} />
        ))}
      </div>
    );
  } else {
    body = (
      <Carousel label={data.title || "Избрани продукти"}>
        {products.map((p) => (
          <div key={p.id} className="w-[calc(50%-0.5rem)] shrink-0 snap-start sm:w-56 lg:w-64">
            <ProductCard product={p} base={ctx.base} />
          </div>
        ))}
      </Carousel>
    );
  }

  return (
    <SectionShell kicker="Магазин" title={data.title || "Избрани продукти"} tone={tone} action={action}>
      {body}
    </SectionShell>
  );
}
