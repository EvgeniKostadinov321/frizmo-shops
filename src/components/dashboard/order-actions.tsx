"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { updateOrderStatus } from "@/actions/orders";
import { Button, ConfirmDialog } from "@/components/ui";

const NEXT_ACTIONS: Record<string, { status: string; label: string }[]> = {
  new: [{ status: "confirmed", label: "Потвърди" }],
  confirmed: [{ status: "shipped", label: "Маркирай като изпратена" }],
  shipped: [{ status: "completed", label: "Завърши" }],
  completed: [],
  cancelled: [],
};

export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function transition(next: string) {
    setLoading(next);
    try {
      const result = await updateOrderStatus({ id: orderId, status: next });
      if (!result.ok) toast.error(result.error);
      else toast.success("Статусът е обновен.");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const actions = NEXT_ACTIONS[status] ?? [];
  const canCancel = status !== "completed" && status !== "cancelled";
  if (actions.length === 0 && !canCancel) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button key={a.status} onClick={() => transition(a.status)} loading={loading === a.status}>
          {a.label}
        </Button>
      ))}
      {canCancel && (
        <Button variant="danger" onClick={() => setConfirmCancel(true)} loading={loading === "cancelled"}>
          Откажи поръчката
        </Button>
      )}
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => transition("cancelled")}
        title="Отказ на поръчката?"
        message="Наличностите на продуктите ще бъдат възстановени. Клиентът НЕ се уведомява автоматично — свържи се с него."
        confirmLabel="Откажи поръчката"
      />
    </div>
  );
}
