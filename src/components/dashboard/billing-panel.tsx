"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, Input, Select } from "@/components/ui";
import { createCheckoutSession, createPortalSession } from "@/actions/billing";

interface BillingPanelProps {
  status: string;
  plan: string;
  currentPeriodEnd: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  trial: "Пробен период",
  trialing: "Пробен период",
  active: "Активен",
  past_due: "Забавено плащане",
  suspended: "Спрян — без плащане",
  canceled: "Отказан",
};

export function BillingPanel({ status, plan, currentPeriodEnd }: BillingPanelProps) {
  const [busy, setBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "pro">(plan === "pro" ? "pro" : "starter");
  const [promo, setPromo] = useState("");
  const hasSubscription = status !== "trial";

  async function subscribe() {
    setBusy(true);
    try {
      const res = await createCheckoutSession({ plan: selectedPlan, promoCode: promo.trim() || undefined });
      if (!res.ok) { toast.error(res.error); return; }
      window.location.href = res.data.url;
    } finally { setBusy(false); }
  }

  async function manage() {
    setBusy(true);
    try {
      const res = await createPortalSession();
      if (!res.ok) { toast.error(res.error); return; }
      window.location.href = res.data.url;
    } finally { setBusy(false); }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-bold text-ink-900">Абонамент</h2>
        <p className="mt-1 text-sm text-ink-500">
          Състояние: <span className="font-medium text-ink-900">{STATUS_LABEL[status] ?? status}</span>
          {currentPeriodEnd && ` · до ${new Date(currentPeriodEnd).toLocaleDateString("bg-BG")}`}
        </p>
      </div>

      {hasSubscription ? (
        <Button loading={busy} onClick={manage}>Управлявай абонамента</Button>
      ) : (
        <div className="flex flex-col gap-3">
          <Select
            label="План"
            options={[
              { value: "starter", label: "Starter — 10 €/мес" },
              { value: "pro", label: "Pro — 20 €/мес" },
            ]}
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value as "starter" | "pro")}
          />
          <Input
            label="Промо код (по избор)"
            placeholder="напр. FRIZMO50"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
          />
          <Button loading={busy} onClick={subscribe}>Абонирай се</Button>
        </div>
      )}
    </Card>
  );
}
