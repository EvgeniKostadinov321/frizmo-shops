"use client";

import { m, useReducedMotion } from "motion/react";
import { Icon, type IconName } from "@/components/ui";
import { SPRING_SNAPPY } from "@/lib/motion";

type SpringIconBadgeProps = {
  name: IconName;
};

/**
 * Кръгла икона-значка със spring влизане при поява във viewport-а
 * (спец §14 „анимираните икони разказват, не стоят"). Уважава reduced-motion.
 */
export function SpringIconBadge({ name }: SpringIconBadgeProps) {
  const reducedMotion = useReducedMotion();
  const className =
    "flex size-11 items-center justify-center rounded-full bg-surface-0 text-brand-600 shadow-card";

  if (reducedMotion) {
    return (
      <span className={className}>
        <Icon name={name} size={21} />
      </span>
    );
  }

  return (
    <m.span
      initial={{ scale: 0.5, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={SPRING_SNAPPY}
      className={className}
    >
      <Icon name={name} size={21} />
    </m.span>
  );
}
