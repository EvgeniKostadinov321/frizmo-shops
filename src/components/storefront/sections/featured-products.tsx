import type { Product } from "@/db";
import type { SectionOfType } from "@/schemas/site-settings";
import { ProductCard } from "../product-card";
import { SectionShell } from "./shared";
import type { SectionContext } from "./index";

interface FeaturedProductsProps {
  data: SectionOfType<"featured-products">["data"];
  products: Product[];
  ctx: SectionContext;
}

export function FeaturedProductsSection({ data, products, ctx }: FeaturedProductsProps) {
  if (products.length === 0) return null;
  return (
    <SectionShell title={data.title || "Избрани продукти"}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} base={ctx.base} />
        ))}
      </div>
    </SectionShell>
  );
}
