"use client";

import { domAnimation, LazyMotion } from "motion/react";

/**
 * LazyMotion зарежда само domAnimation фийчърите (~15KB gz) вместо пълния
 * motion бандъл — задължителна конвенция (виж eslint правилото за m. vs motion.).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}
