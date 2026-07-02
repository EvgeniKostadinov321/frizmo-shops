"use client";

import { useEffect, useRef } from "react";

/** Държи най-новия callback, без да кара ефектите да се re-изпълняват. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
