import { SectionShell } from "../shared";
import type { ContactVariantProps } from "./index";
import { contactInfo, InfoRows, MapFrame } from "./shared-parts";

/** Вариант 1 — editorial редове (иконка + label · value) до картата. */
export function ContactRows({ data, ctx, tone }: ContactVariantProps) {
  const { shop } = ctx;
  const { fullAddress } = contactInfo(shop);
  const showMap = data.showMap && fullAddress;

  return (
    <SectionShell kicker="Контакти" title={data.title || "Къде да ни намериш"} tone={tone}>
      <div className={`grid gap-10 ${showMap ? "md:grid-cols-[2fr_3fr]" : "md:max-w-xl"}`}>
        <InfoRows shop={shop} />
        {showMap && (
          <MapFrame
            address={fullAddress}
            className="h-72 w-full rounded-(--sf-radius) border border-(--sf-border) shadow-(--sf-shadow) md:h-full md:min-h-96"
          />
        )}
      </div>
    </SectionShell>
  );
}
