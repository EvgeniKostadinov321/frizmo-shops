import type { SectionOfType } from "@/schemas/site-settings";
import type { SectionTone } from "../shared";
import { FaqAccordion } from "./variant-1-accordion";
import { FaqSpread } from "./variant-2-spread";

/** Общият props контракт на вариантите на FAQ. */
export interface FaqVariantProps {
  data: SectionOfType<"faq">["data"];
  tone?: SectionTone;
}

const VARIANTS = {
  1: FaqAccordion,
  2: FaqSpread,
} as const;

/**
 * Dispatcher: чете data.variant (1 = центриран акордеон с карти, 2 = spread
 * със заглавие вляво и hairline редове) и рендерира композицията.
 */
export function FaqSection(props: FaqVariantProps) {
  const Variant = VARIANTS[props.data.variant] ?? FaqAccordion;
  return <Variant {...props} />;
}
