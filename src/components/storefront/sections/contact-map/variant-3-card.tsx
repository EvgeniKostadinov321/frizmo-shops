import { Icon } from "@/components/ui";
import { SectionShell } from "../shared";
import type { ContactVariantProps } from "./index";
import { contactInfo, MapFrame } from "./shared-parts";

/**
 * Вариант 3 — типографска визитка: телефонът и имейлът са ЕДРИ display редове
 * (клик = обаждане/писмо) в центъра, адрес + работно време отдолу, картата в
 * свиваем „Покажи картата" блок. Минимал — за магазини, при които контактът е
 * действието, не локацията.
 */
export function ContactCard({ data, ctx, tone }: ContactVariantProps) {
  const { shop } = ctx;
  const { fullAddress, hours } = contactInfo(shop);
  const showMap = data.showMap && fullAddress;

  return (
    <SectionShell tone={tone} titleHidden>
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary)">
            Контакти
          </p>
          <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] text-(--sf-text)">
            {data.title || "Свържи се с нас"}
          </h2>
        </div>

        {/* Едрите действия — типографията Е интерфейсът */}
        <div className="flex flex-col items-center gap-3">
          {shop.phone && (
            <a
              href={`tel:${shop.phone}`}
              className="font-(family-name:--sf-font-heading) text-[clamp(1.75rem,5vw,3.25rem)] leading-tight text-(--sf-text) underline-offset-8 transition-colors hover:text-(--sf-primary) hover:underline"
              style={{ fontWeight: "var(--sf-heading-weight)" }}
            >
              {shop.phone}
            </a>
          )}
          {shop.email && (
            <a
              href={`mailto:${shop.email}`}
              className="break-all text-[clamp(1.125rem,2.5vw,1.5rem)] text-(--sf-primary) underline-offset-4 hover:underline"
            >
              {shop.email}
            </a>
          )}
        </div>

        {/* Адрес + часове — тихи мета редове */}
        {(fullAddress || hours.length > 0) && (
          <div className="flex flex-col items-center gap-2 text-(--sf-muted)">
            {fullAddress && (
              <p className="flex items-center gap-2">
                <Icon name="map-pin" size={16} className="text-(--sf-primary)" />
                {fullAddress}
              </p>
            )}
            {hours.length > 0 && (
              <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
                {hours.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </p>
            )}
          </div>
        )}

        {/* Картата — по избор, в свиваем блок */}
        {showMap && (
          <details className="sf-details group w-full">
            <summary className="mx-auto flex h-11 w-fit cursor-pointer list-none items-center gap-1.5 font-medium text-(--sf-primary) underline-offset-4 hover:underline">
              Покажи картата
              <span aria-hidden className="transition-transform duration-300 group-open:rotate-180">
                <Icon name="chevron-down" size={16} />
              </span>
            </summary>
            <MapFrame
              address={fullAddress}
              className="mt-4 h-80 w-full rounded-(--sf-radius) border border-(--sf-border) shadow-(--sf-shadow)"
            />
          </details>
        )}
      </div>
    </SectionShell>
  );
}
