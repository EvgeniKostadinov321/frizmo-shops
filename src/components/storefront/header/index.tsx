import type { HeaderVariantProps } from "./shared";
import { HeaderVariant1 } from "./variant-1-inline";
import { HeaderVariant2 } from "./variant-2-split-bar";
import { HeaderVariant3 } from "./variant-3-minimal";

const VARIANTS = {
  1: HeaderVariant1,
  2: HeaderVariant2,
  3: HeaderVariant3,
} as const;

/**
 * Header dispatcher: чете settings.headerVariant и рендерира съответната
 * композиция. Трите варианта споделят props и четат само --sf-* токени —
 * темата облича варианта с гласа си.
 */
export function StorefrontHeader(props: HeaderVariantProps) {
  const Variant = VARIANTS[props.settings.headerVariant] ?? HeaderVariant1;
  return <Variant {...props} />;
}
