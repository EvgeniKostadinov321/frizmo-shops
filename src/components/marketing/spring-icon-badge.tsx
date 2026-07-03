"use client";

import { m } from "motion/react";
import { Icon, type IconName } from "@/components/ui";
import { SPRING_SNAPPY } from "@/lib/motion";

type SpringIconBadgeProps = {
  name: IconName;
};

/**
 * Кръгла икона-значка със spring влизане при поява във viewport-а
 * (спец §14 „анимираните икони разказват, не стоят"). Reduced-motion
 * се поема централно от MotionConfig (hydration-safe).
 */
export function SpringIconBadge({ name }: SpringIconBadgeProps) {
  return (
    <m.span
      initial={{ scale: 0.5, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={SPRING_SNAPPY}
      className="flex size-11 items-center justify-center rounded-full bg-surface-0 text-brand-600 shadow-card"
    >
      <Icon name={name} size={21} />
    </m.span>
  );
}
