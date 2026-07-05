import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/db";
import type { CategoryCover } from "@/db/queries/storefront";
import { publicImageUrl } from "@/lib/storage";
import type { CategoryVariantProps } from "./index";

/** Категорийна плочка в мозайката: снимка + overlay + сериф име + брой. */
function CategoryTile({
  category,
  cover,
  base,
  heightClass,
  large = false,
}: {
  category: Category;
  cover: CategoryCover | undefined;
  base: string;
  heightClass: string;
  large?: boolean;
}) {
  const image = cover?.imagePath;
  const count = cover?.productCount ?? 0;
  const countLabel = count > 0 ? `${count} ${count === 1 ? "продукт" : "продукта"}` : null;

  return (
    <Link
      href={`${base}/products?category=${category.id}`}
      className={`sf-frame group relative flex ${heightClass} items-end overflow-hidden ${
        image ? "" : "bg-(--sf-surface-raised)"
      }`}
    >
      {image && (
        <>
          <Image
            src={publicImageUrl(image)}
            alt=""
            fill
            sizes={large ? "(max-width: 640px) 100vw, 50vw" : "(max-width: 640px) 100vw, 33vw"}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          <div aria-hidden className="absolute inset-0" style={{ background: "var(--sf-overlay)" }} />
          {/* Hover: лек допълнителен потъмняващ воал — плочката „отговаря" */}
          <div
            aria-hidden
            className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/15"
          />
        </>
      )}
      <span
        className={`relative z-10 flex w-full flex-col gap-1.5 transition-transform duration-300 group-hover:-translate-y-1 ${
          large ? "p-8 sm:p-10" : "p-5 sm:p-6"
        }`}
      >
        <span
          className={`font-(family-name:--sf-font-heading) leading-tight ${
            image ? "text-white" : "text-(--sf-text)"
          } ${large ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}
          style={{ fontWeight: "var(--sf-heading-weight)" }}
        >
          {category.name}
        </span>
        {countLabel && (
          <span
            className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] ${
              image ? "text-white/85" : "text-(--sf-muted)"
            }`}
          >
            {countLabel}
            <span
              aria-hidden
              className="translate-x-0 text-(--sf-accent) transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </span>
        )}
      </span>
    </Link>
  );
}

/** Вариант 1 — full-bleed мозайка: плочки edge-to-edge, адаптивни по брой. */
export function CategoryMosaic({ data, ctx, tone }: CategoryVariantProps) {
  const selected =
    data.categoryIds.length > 0
      ? ctx.categories.filter((c) => data.categoryIds.includes(c.id))
      : ctx.categories.filter((c) => c.parentId === null).slice(0, 8);
  if (selected.length === 0) return null;
  const count = selected.length;

  /* Мозайка по брой — пълноширинна (edge-to-edge), с тънки фуги:
     1 → банер · 2 → две половини · 3 → триптих · 4–6 → мрежа 3 кол ·
     7+ → плътна мрежа 4 кол. */
  let grid: string;
  let heightClass: string;
  let large = false;
  if (count === 1) {
    grid = "grid-cols-1";
    heightClass = "h-64 sm:h-80";
    large = true;
  } else if (count === 2) {
    grid = "grid-cols-1 sm:grid-cols-2";
    heightClass = "h-64 sm:h-[26rem]";
    large = true;
  } else if (count === 3) {
    grid = "grid-cols-1 sm:grid-cols-3";
    heightClass = "h-56 sm:h-80";
  } else if (count <= 6) {
    grid = "grid-cols-2 lg:grid-cols-3";
    heightClass = "h-48 sm:h-64";
  } else {
    grid = "grid-cols-2 lg:grid-cols-4";
    heightClass = "h-40 sm:h-52";
  }

  /* Собствен section (не SectionShell): заглавието е в контейнера, а мозайката
     чупи контейнера и опира в двата ръба на екрана. */
  return (
    <section
      className={
        tone === "surface" ? "bg-(--sf-surface) [background-image:var(--sf-surface-wash)]" : ""
      }
    >
      <div className="mx-auto w-full max-w-6xl px-4 pt-16 sm:pt-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary)">
              Колекции
            </p>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] text-(--sf-text)">
              {data.title || "Разгледай по категория"}
            </h2>
          </div>
          <Link
            href={`${ctx.base}/products`}
            className="shrink-0 pb-1 font-medium text-(--sf-primary) hover:opacity-75"
          >
            Виж всички →
          </Link>
        </div>
      </div>
      <div className={`grid gap-0.5 pb-16 sm:pb-20 ${grid}`}>
        {selected.map((category) => (
          <CategoryTile
            key={category.id}
            category={category}
            cover={ctx.categoryCovers[category.id]}
            base={ctx.base}
            heightClass={heightClass}
            large={large}
          />
        ))}
      </div>
    </section>
  );
}
