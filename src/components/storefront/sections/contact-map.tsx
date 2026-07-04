import { Icon } from "@/components/ui";
import { formatWorkingHours, parseWorkingHours } from "@/lib/working-hours";
import type { SectionOfType } from "@/schemas/site-settings";
import { SectionShell } from "./shared";
import type { SectionContext } from "./index";

interface ContactMapProps {
  data: SectionOfType<"contact-map">["data"];
  ctx: SectionContext;
}

export function ContactMapSection({ data, ctx }: ContactMapProps) {
  const { shop } = ctx;
  const fullAddress = [shop.address, shop.city].filter(Boolean).join(", ");
  const hours = formatWorkingHours(parseWorkingHours(shop.workingHours));

  return (
    <SectionShell title={data.title || "Къде да ни намериш"}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2 text-(--sf-muted)">
          {fullAddress && (
            <p className="flex items-center gap-2 text-(--sf-text)">
              <Icon name="map-pin" size={18} className="shrink-0 text-(--sf-primary)" />
              {fullAddress}
            </p>
          )}
          {shop.phone && (
            <p className="flex items-center gap-2">
              <Icon name="phone" size={18} className="shrink-0 text-(--sf-primary)" />
              <a href={`tel:${shop.phone}`} className="hover:opacity-70">
                {shop.phone}
              </a>
            </p>
          )}
          {shop.email && (
            <p className="flex items-center gap-2">
              <Icon name="mail" size={18} className="shrink-0 text-(--sf-primary)" />
              <a href={`mailto:${shop.email}`} className="hover:opacity-70">
                {shop.email}
              </a>
            </p>
          )}
          {hours.length > 0 && (
            <div className="mt-2">
              <p className="font-medium text-(--sf-text)">Работно време</p>
              {hours.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}
        </div>
        {data.showMap && fullAddress && (
          <iframe
            title={`Карта: ${fullAddress}`}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed&hl=bg`}
            className="h-64 w-full rounded-(--sf-radius) border border-(--sf-border)"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </SectionShell>
  );
}
