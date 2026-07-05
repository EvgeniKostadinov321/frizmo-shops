import { Icon, type IconName } from "@/components/ui/icon";
import type { Shop } from "@/db";
import { formatWorkingHours, parseWorkingHours } from "@/lib/working-hours";

/** Извлечените контактни данни на магазина — общи за трите варианта. */
export function contactInfo(shop: Shop) {
  const fullAddress = [shop.address, shop.city].filter(Boolean).join(", ");
  const hours = formatWorkingHours(parseWorkingHours(shop.workingHours));
  const directionsUrl = fullAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`
    : null;
  return { fullAddress, hours, directionsUrl };
}

/** Editorial label/value ред: иконка в primary + hairline отдолу. */
export function InfoRow({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-4 border-b border-(--sf-border) py-3.5">
      <span aria-hidden className="translate-y-0.5 text-(--sf-primary)">
        <Icon name={icon} size={17} />
      </span>
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-(--sf-muted)">
        {label}
      </span>
      <span className="ml-auto text-right text-(--sf-text)">{children}</span>
    </div>
  );
}

/** Google Maps embed — общ за вариантите с карта. */
export function MapFrame({
  address,
  className,
}: {
  address: string;
  className: string;
}) {
  return (
    <iframe
      title={`Карта: ${address}`}
      src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&hl=bg`}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

/** Пълният сет редове (адрес/телефон/имейл/часове) + „Виж маршрут". */
export function InfoRows({ shop }: { shop: Shop }) {
  const { fullAddress, hours, directionsUrl } = contactInfo(shop);
  return (
    <div className="flex flex-col">
      {fullAddress && (
        <InfoRow icon="map-pin" label="Адрес">
          {fullAddress}
        </InfoRow>
      )}
      {shop.phone && (
        <InfoRow icon="phone" label="Телефон">
          <a href={`tel:${shop.phone}`} className="font-medium text-(--sf-primary) hover:opacity-75">
            {shop.phone}
          </a>
        </InfoRow>
      )}
      {shop.email && (
        <InfoRow icon="mail" label="Имейл">
          <a
            href={`mailto:${shop.email}`}
            className="break-all font-medium text-(--sf-primary) hover:opacity-75"
          >
            {shop.email}
          </a>
        </InfoRow>
      )}
      {hours.length > 0 && (
        <InfoRow icon="store" label="Работно време">
          <span className="flex flex-col gap-0.5">
            {hours.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        </InfoRow>
      )}
      {directionsUrl && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex h-11 w-fit items-center gap-1.5 font-medium text-(--sf-primary) underline-offset-4 hover:underline"
        >
          Виж маршрут <Icon name="external-link" size={16} />
        </a>
      )}
    </div>
  );
}
