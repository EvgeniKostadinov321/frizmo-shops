"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkGuestOrders } from "@/actions/buyer";
import { Button } from "@/components/ui";
import { count, NOUNS } from "@/lib/plural";

/** Показва се само ако има несвързани гост-поръчки по телефона на профила. */
export function LinkOrdersBanner({ pending }: { pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (pending <= 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-card border border-brand-600/30 bg-surface-0 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-700">
        Намерихме {count(pending, NOUNS.order)} с твоя телефон отпреди акаунта.
      </p>
      <Button
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const res = await linkGuestOrders();
            if (res.ok) router.refresh();
            else setMsg(res.error);
          } finally {
            setBusy(false);
          }
        }}
      >
        Свържи с акаунта
      </Button>
      {msg && <p className="text-sm text-danger-600">{msg}</p>}
    </div>
  );
}
