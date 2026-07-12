"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkGuestOrders } from "@/actions/buyer";
import { count, NOUNS } from "@/lib/plural";

/** Показва се само ако има несвързани гост-поръчки по телефона на профила.
    Клик → свързва ги с акаунта (по потвърден телефон) → refresh. */
export function LinkOrdersBanner({ pending }: { pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (pending <= 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-(--sf-radius) border border-(--sf-primary) bg-(--sf-surface) p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-(--sf-text)">
        Намерихме {count(pending, NOUNS.order)} с твоя телефон отпреди акаунта.
      </p>
      <button
        type="button"
        disabled={busy}
        className="shrink-0 rounded-(--sf-radius) bg-(--sf-primary) px-4 py-2 text-sm font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:opacity-60"
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const res = await linkGuestOrders();
            if (res.ok) {
              router.refresh();
            } else {
              setMsg(res.error);
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Свързване…" : "Свържи с акаунта"}
      </button>
      {msg && <p className="text-sm text-(--sf-accent)">{msg}</p>}
    </div>
  );
}
