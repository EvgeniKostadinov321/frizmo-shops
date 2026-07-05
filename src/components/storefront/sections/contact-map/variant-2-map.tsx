import { SectionShell } from "../shared";
import type { ContactVariantProps } from "./index";
import { contactInfo, InfoRows, MapFrame } from "./shared-parts";

/**
 * Вариант 2 — карта-фон: широка карта, а инфо-панелът (surface-raised карта)
 * ПЛАВА върху нея вляво. Без адрес (няма карта) пада към редовете на вариант 1.
 * На мобилно: картата отгоре, панелът под нея.
 */
export function ContactMapBackdrop({ data, ctx, tone }: ContactVariantProps) {
  const { shop } = ctx;
  const { fullAddress } = contactInfo(shop);
  const showMap = data.showMap && fullAddress;

  if (!showMap) return <ContactFallback data={data} ctx={ctx} tone={tone} />;

  return (
    <SectionShell kicker="Контакти" title={data.title || "Къде да ни намериш"} tone={tone}>
      {/* Grid застъпване вместо absolute: редът расте с по-високия елемент —
         дълги InfoRows не изскачат от картата (R3 от одита). */}
      <div className="md:grid md:grid-cols-12 md:items-center">
        <MapFrame
          address={fullAddress}
          className="h-72 w-full rounded-(--sf-radius) border border-(--sf-border) shadow-(--sf-shadow) md:col-span-full md:row-start-1 md:h-full md:min-h-120"
        />
        <div className="relative z-10 -mt-10 mx-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-6 shadow-(--sf-shadow) sm:p-7 md:col-start-1 md:col-end-5 md:row-start-1 md:mx-0 md:ml-8 md:my-8">
          <InfoRows shop={shop} />
        </div>
      </div>
    </SectionShell>
  );
}

/** Fallback без карта — редовете в тясна колона. */
function ContactFallback({ data, ctx, tone }: ContactVariantProps) {
  return (
    <SectionShell kicker="Контакти" title={data.title || "Къде да ни намериш"} tone={tone}>
      <div className="md:max-w-xl">
        <InfoRows shop={ctx.shop} />
      </div>
    </SectionShell>
  );
}
