import type { HeroVariantProps } from "./shared";
import { HeroPoster } from "./variant-poster";
import { HeroSplit } from "./variant-split";
import { HeroStatement } from "./variant-statement";

const VARIANTS = {
  split: HeroSplit,
  poster: HeroPoster,
  statement: HeroStatement,
} as const;

/**
 * Hero dispatcher: чете data.layout (split | poster | statement) и рендерира
 * съответната композиция. Трите варианта споделят props и четат само --sf-*
 * токени — темата облича варианта с гласа/подписа си.
 */
export function HeroSection({ data, ctx }: HeroVariantProps) {
  const Variant = VARIANTS[data.layout] ?? HeroSplit;
  return <Variant data={data} ctx={ctx} />;
}
