import type { SectionOfType } from "@/schemas/site-settings";
import type { SectionContext } from "../index";
import type { SectionTone } from "../shared";
import { CategoryList } from "./variant-2-list";
import { CategoryMosaic } from "./variant-1-mosaic";

/** Общият props контракт на вариантите на „Категории". */
export interface CategoryVariantProps {
  data: SectionOfType<"category-grid">["data"];
  ctx: SectionContext;
  tone?: SectionTone;
}

const VARIANTS = {
  1: CategoryMosaic,
  2: CategoryList,
} as const;

/**
 * Dispatcher: чете data.variant (1 = full-bleed мозайка, 2 = номериран
 * списък-меню) и рендерира композицията. Вариантите споделят props и четат
 * само --sf-* токени.
 */
export function CategoryGridSection(props: CategoryVariantProps) {
  const Variant = VARIANTS[props.data.variant] ?? CategoryMosaic;
  return <Variant {...props} />;
}
