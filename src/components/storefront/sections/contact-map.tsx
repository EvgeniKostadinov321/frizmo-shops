import { formatWorkingHours, parseWorkingHours } from "@/lib/working-hours";
import type { SectionOfType } from "@/schemas/site-settings";
import { SectionShell, type SectionTone } from "./shared";
import type { SectionContext } from "./index";

interface ContactMapProps {
  data: SectionOfType<"contact-map">["data"];
  ctx: SectionContext;
  tone?: SectionTone;
}

/** Editorial label/value ред с hairline отдолу. */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-(--sf-border) py-3.5">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-(--sf-muted)">
        {label}
      </span>
      <span className="text-right text-(--sf-text)">{children}</span>
    </div>
  );
}

export function ContactMapSection({ data, ctx, tone }: ContactMapProps) {
  const { shop } = ctx;
  const fullAddress = [shop.address, shop.city].filter(Boolean).join(", ");
  const hours = formatWorkingHours(parseWorkingHours(shop.workingHours));
  const showMap = data.showMap && fullAddress;

  return (
    <SectionShell kicker="Контакти" title={data.title || "Къде да ни намериш"} tone={tone}>
      <div className={`grid gap-10 ${showMap ? "md:grid-cols-[2fr_3fr]" : "md:max-w-xl"}`}>
        <div className="flex flex-col">
          {fullAddress && <InfoRow label="Адрес">{fullAddress}</InfoRow>}
          {shop.phone && (
            <InfoRow label="Телефон">
              <a href={`tel:${shop.phone}`} className="hover:opacity-70">
                {shop.phone}
              </a>
            </InfoRow>
          )}
          {shop.email && (
            <InfoRow label="Имейл">
              <a href={`mailto:${shop.email}`} className="break-all hover:opacity-70">
                {shop.email}
              </a>
            </InfoRow>
          )}
          {hours.length > 0 && (
            <InfoRow label="Работно време">
              <span className="flex flex-col gap-0.5">
                {hours.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
            </InfoRow>
          )}
        </div>
        {showMap && (
          <iframe
            title={`Карта: ${fullAddress}`}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed&hl=bg`}
            className="h-72 w-full rounded-(--sf-radius) border border-(--sf-border) shadow-(--sf-shadow) md:h-full md:min-h-96"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </SectionShell>
  );
}
