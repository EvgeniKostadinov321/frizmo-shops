"use client";

import { useEffect, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { Icon } from "@/components/ui";
import { SPRING_SNAPPY } from "@/lib/motion";

type MiniShopHeaderProps = {
  name: string;
  city: string;
};

/**
 * Мини header на витрината: име, град и „количка", която получава badge
 * със spring пулс ~1.4s след сглобяването — демонстрира поръчка без думи.
 */
export function MiniShopHeader({ name, city }: MiniShopHeaderProps) {
  const reducedMotion = useReducedMotion();
  const [badgeVisible, setBadgeVisible] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(() => setBadgeVisible(true), 1400);
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  return (
    <div className="flex items-center justify-between px-5 pt-5">
      <div>
        <p className="font-display text-lg font-extrabold leading-tight text-ink-900">{name}</p>
        <p className="text-[11px] text-ink-500">{city} · отворено днес</p>
      </div>
      <span className="relative flex size-9 items-center justify-center rounded-full bg-brand-600 text-white">
        <Icon name="store" size={16} />
        {(badgeVisible || reducedMotion) && (
          <m.span
            initial={reducedMotion ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...SPRING_SNAPPY, damping: 14 }}
            className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-ember-500 text-[9px] font-bold text-white"
          >
            1
          </m.span>
        )}
      </span>
    </div>
  );
}
