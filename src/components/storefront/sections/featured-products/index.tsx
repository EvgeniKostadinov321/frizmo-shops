import type { Product } from "@/db";
import type { SectionOfType } from "@/schemas/site-settings";
import type { SectionContext } from "../index";
import type { SectionTone } from "../shared";
import { FeaturedEditorial } from "./variant-2-editorial";
import { FeaturedGrid } from "./variant-1-grid";

/** Общият props контракт на вариантите на „Избрани продукти". */
export interface FeaturedVariantProps {
  data: SectionOfType<"featured-products">["data"];
  products: Product[];
  ctx: SectionContext;
  tone?: SectionTone;
}

const VARIANTS = {
  1: FeaturedGrid,
  2: FeaturedEditorial,
} as const;

/**
 * Dispatcher: чете data.variant (1 = адаптивен grid, 2 = editorial списък)
 * и рендерира композицията. Вариантите споделят props и четат само --sf-*
 * токени — темата облича варианта с гласа си.
 */
export function FeaturedProductsSection(props: FeaturedVariantProps) {
  if (props.products.length === 0) return null;
  const Variant = VARIANTS[props.data.variant] ?? FeaturedGrid;
  return <Variant {...props} />;
}
