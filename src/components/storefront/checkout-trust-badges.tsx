import { Icon } from "@/components/ui";
import { buildCheckoutBadges } from "@/lib/checkout-badges";

interface CheckoutTrustBadgesProps {
  returnWindowDays: number;
  hasCod: boolean;
}

/** Тиха hairline лента с авто trust badges — реюз на стила от trust-badges вариант 2. */
export function CheckoutTrustBadges({ returnWindowDays, hasCod }: CheckoutTrustBadgesProps) {
  const badges = buildCheckoutBadges(returnWindowDays, hasCod);
  return (
    <div className="mb-8 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-(--sf-border) py-4 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-2">
      {badges.map((badge, i) => (
        <span key={badge.text} className="flex items-center gap-x-2">
          {/* Точка-разделител само на десктоп (в редовия изглед). */}
          {i > 0 && (
            <span aria-hidden className="mx-3 hidden size-1 rounded-full bg-(--sf-border) sm:block" />
          )}
          <span aria-hidden className="shrink-0 text-(--sf-primary)">
            <Icon name={badge.icon} size={17} />
          </span>
          <span className="text-sm font-medium text-(--sf-text)">{badge.text}</span>
        </span>
      ))}
    </div>
  );
}
