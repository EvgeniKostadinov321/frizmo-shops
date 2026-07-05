import type { SectionOfType } from "@/schemas/site-settings";
import { TestimonialsCards } from "./variant-2-cards";
import { TestimonialsInverted } from "./variant-1-inverted";

/** Общият props контракт на вариантите на отзивите. */
export interface TestimonialsVariantProps {
  data: SectionOfType<"testimonials">["data"];
}

/** ★★★★★ в акцентния цвят — отзивите на търговеца са по природа 5/5. */
export function Stars() {
  return (
    <span aria-hidden className="tracking-[0.2em] text-(--sf-accent)">
      ★★★★★
    </span>
  );
}

const VARIANTS = {
  1: TestimonialsInverted,
  2: TestimonialsCards,
} as const;

/**
 * Dispatcher: чете data.variant (1 = тъмна инверсия, 2 = светли карти) и
 * рендерира композицията.
 */
export function TestimonialsSection(props: TestimonialsVariantProps) {
  const Variant = VARIANTS[props.data.variant] ?? TestimonialsInverted;
  return <Variant {...props} />;
}
