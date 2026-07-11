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
    <div className="mb-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-3 border-y border-(--sf-border) py-4">
      {badges.map((badge, i) => (
        <span key={badge.text} className="flex items-center gap-x-2">
          {i > 0 && <span aria-hidden className="mx-3 size-1 rounded-full bg-(--sf-border)" />}
          <span aria-hidden className="text-(--sf-primary)">
            <Icon name={badge.icon} size={17} />
          </span>
          <span className="text-sm font-medium text-(--sf-text)">{badge.text}</span>
        </span>
      ))}
    </div>
  );
}
