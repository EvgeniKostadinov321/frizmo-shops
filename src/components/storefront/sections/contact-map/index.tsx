import type { SectionOfType } from "@/schemas/site-settings";
import type { SectionContext } from "../index";
import type { SectionTone } from "../shared";
import { ContactCard } from "./variant-3-card";
import { ContactMapBackdrop } from "./variant-2-map";
import { ContactRows } from "./variant-1-rows";

/** Общият props контракт на контактните варианти. */
export interface ContactVariantProps {
  data: SectionOfType<"contact-map">["data"];
  ctx: SectionContext;
  tone?: SectionTone;
}

const VARIANTS = {
  1: ContactRows,
  2: ContactMapBackdrop,
  3: ContactCard,
} as const;

/**
 * Dispatcher: чете data.variant (1 = редове + карта, 2 = карта-фон с плаващ
 * панел, 3 = типографска визитка) и рендерира композицията.
 */
export function ContactMapSection(props: ContactVariantProps) {
  const Variant = VARIANTS[props.data.variant] ?? ContactRows;
  return <Variant {...props} />;
}
