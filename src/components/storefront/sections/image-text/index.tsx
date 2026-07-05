import type { ImageTextData } from "./shared";
import { ImageTextOverlap } from "./variant-2-overlap";
import { ImageTextSplit } from "./variant-1-split";

const VARIANTS = {
  1: ImageTextSplit,
  2: ImageTextOverlap,
} as const;

/**
 * Dispatcher: чете data.variant (1 = разделени колони, 2 = застъпваща
 * текст-карта) и рендерира композицията.
 */
export function ImageTextSection({ data }: { data: ImageTextData }) {
  if (!data.text && !data.imagePath) return null;
  const Variant = VARIANTS[data.variant] ?? ImageTextSplit;
  return <Variant data={data} />;
}
