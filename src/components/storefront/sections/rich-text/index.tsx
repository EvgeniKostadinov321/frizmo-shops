import type { SectionOfType } from "@/schemas/site-settings";
import type { SectionTone } from "../shared";
import { RichTextCentered } from "./variant-1-centered";
import { RichTextSpread } from "./variant-2-spread";

/** Общият props контракт на вариантите на текстовия блок. */
export interface RichTextVariantProps {
  data: SectionOfType<"rich-text">["data"];
  tone?: SectionTone;
}

const VARIANTS = {
  1: RichTextCentered,
  2: RichTextSpread,
} as const;

/**
 * Dispatcher: чете data.variant (1 = центриран с drop cap, 2 = асиметричен
 * spread) и рендерира композицията.
 */
export function RichTextSection(props: RichTextVariantProps) {
  if (!props.data.text) return null;
  const Variant = VARIANTS[props.data.variant] ?? RichTextCentered;
  return <Variant {...props} />;
}
