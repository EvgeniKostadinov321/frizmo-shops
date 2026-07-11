"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reorderToCart } from "@/actions/reorder";
import { addToCart } from "@/lib/cart-storage";
import { count, NOUNS } from "@/lib/plural";

/**
 * „Поръчай пак същото" — зарежда наличните артикули на поръчката в количката.
 * shopId е нужен на клиентската количка (localStorage per shopId); token дава
 * достъп до поръчката на сървъра.
 */
export function ReorderButton({
  shopSlug,
  shopId,
  orderId,
  token,
}: {
  shopSlug: string;
  shopId: string;
  orderId: string;
  token: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    startTransition(async () => {
      const res = await reorderToCart(shopSlug, { orderId, token });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      for (const line of res.data.lines) {
        addToCart(shopId, {
          productId: line.productId,
          variantKey: line.variantKey,
          qty: line.quantity,
        });
      }
      const added = res.data.lines.length;
      const skipped = res.data.skipped.length;
      setMsg(
        skipped > 0
          ? `Добавени ${count(added, NOUNS.item)}; ${count(skipped, NOUNS.item)} вече не са налични.`
          : `Добавени ${count(added, NOUNS.item)} в количката.`,
      );
      router.push(`/s/${shopSlug}/cart`);
    });
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex h-11 items-center rounded-(--sf-radius) bg-(--sf-primary) px-6 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Момент…" : "Поръчай пак същото"}
      </button>
      {msg && <p className="text-sm text-(--sf-muted)">{msg}</p>}
    </div>
  );
}
