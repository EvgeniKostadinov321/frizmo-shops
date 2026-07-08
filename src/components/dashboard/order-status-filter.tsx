"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui";

interface OrderStatusFilterProps {
  options: { value: string; label: string }[];
  value: string;
}

/** Филтър по статус на поръчка — навигира при избор (заменя pill бутоните). */
export function OrderStatusFilter({ options, value }: OrderStatusFilterProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Select
      label="Филтър по статус"
      hideLabel
      options={options}
      value={value}
      disabled={pending}
      onChange={(e) =>
        startTransition(() => {
          router.push(
            e.target.value ? `/dashboard/orders?status=${e.target.value}` : "/dashboard/orders",
          );
        })
      }
    />
  );
}
