import Link from "next/link";
import type { SectionOfType } from "@/schemas/site-settings";
import { SectionShell } from "./shared";
import type { SectionContext } from "./index";

interface CategoryGridProps {
  data: SectionOfType<"category-grid">["data"];
  ctx: SectionContext;
}

export function CategoryGridSection({ data, ctx }: CategoryGridProps) {
  const selected =
    data.categoryIds.length > 0
      ? ctx.categories.filter((c) => data.categoryIds.includes(c.id))
      : ctx.categories.filter((c) => c.parentId === null).slice(0, 8);
  if (selected.length === 0) return null;

  return (
    <SectionShell title={data.title || "Разгледай по категория"}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {selected.map((category) => (
          <Link
            key={category.id}
            href={`${ctx.base}/products?category=${category.id}`}
            className="flex h-24 items-center justify-center rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4 text-center font-medium text-(--sf-text) transition-colors hover:border-(--sf-primary) hover:text-(--sf-primary)"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}
