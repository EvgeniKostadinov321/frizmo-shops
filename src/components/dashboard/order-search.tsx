"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui";

/**
 * Търсене на поръчки — навигира с `?q=...`, пази другите searchParams (статус).
 * Debounce 300ms (да не навигира при всяка буква). URL-driven → пагинация и
 * споделяне на линк работят; при търсене страницата се нулира (без `page`).
 */
export function OrderSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  /* Пропускаме първата навигация — иначе mount-ът пренавигира без нужда. */
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const q = value.trim();
      if (q) params.set("q", q);
      else params.delete("q");
      params.delete("page"); // ново търсене → от първа страница
      const qs = params.toString();
      router.push(qs ? `/dashboard/orders?${qs}` : "/dashboard/orders");
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      label="Търси поръчка"
      hideLabel
      type="search"
      placeholder="Търси по номер, име или телефон…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
