"use client";

import * as RadixAccordion from "@radix-ui/react-accordion";
import { Icon } from "./icon";

type AccordionItem = {
  value: string;
  question: string;
  answer: string;
};

type AccordionProps = {
  items: AccordionItem[];
};

/**
 * FAQ акордеон върху Radix Accordion (single mode, collapsible) — ARIA
 * наготово (focus, aria-expanded, keyboard). Височината се анимира с CSS
 * keyframes върху --radix-accordion-content-height (виж globals.css).
 */
export function Accordion({ items }: AccordionProps) {
  return (
    <RadixAccordion.Root type="single" collapsible className="flex flex-col">
      {items.map((item) => (
        <RadixAccordion.Item
          key={item.value}
          value={item.value}
          className="border-t border-surface-200 last:border-b"
        >
          <RadixAccordion.Header>
            <RadixAccordion.Trigger className="group flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 py-5 text-left font-medium text-ink-900">
              {item.question}
              <Icon
                name="chevron-down"
                size={18}
                className="shrink-0 text-ink-500 transition-transform duration-200 group-data-[state=open]:rotate-180"
              />
            </RadixAccordion.Trigger>
          </RadixAccordion.Header>
          <RadixAccordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none">
            <p className="pb-6 leading-relaxed text-ink-700">{item.answer}</p>
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
