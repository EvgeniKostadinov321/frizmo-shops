import { Badge } from "@/components/ui";

export const ORDER_STATUS_LABELS: Record<
  string,
  { label: string; tone: "neutral" | "brand" | "warning" | "success" | "danger" }
> = {
  new: { label: "Нова", tone: "brand" },
  confirmed: { label: "Потвърдена", tone: "warning" },
  shipped: { label: "Изпратена", tone: "neutral" },
  completed: { label: "Завършена", tone: "success" },
  cancelled: { label: "Отказана", tone: "danger" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const meta = ORDER_STATUS_LABELS[status] ?? ORDER_STATUS_LABELS.new!;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
