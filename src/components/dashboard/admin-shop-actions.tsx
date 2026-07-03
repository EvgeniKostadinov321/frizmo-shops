"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { setShopStatus } from "@/actions/admin";
import { Button, ConfirmDialog } from "@/components/ui";

export function AdminShopActions({ shopId, status, name }: { shopId: string; status: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);

  async function run(action: string) {
    setLoading(action);
    try {
      const result = await setShopStatus({ shopId, action });
      if (!result.ok) toast.error(result.error);
      else toast.success("Готово.");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex justify-end gap-1">
      {status === "published" && (
        <Button variant="ghost" size="sm" onClick={() => run("suspend")} loading={loading === "suspend"}>
          Скрий
        </Button>
      )}
      {status === "suspended" && (
        <Button variant="ghost" size="sm" onClick={() => run("restore")} loading={loading === "restore"}>
          Възстанови
        </Button>
      )}
      {status !== "blocked" ? (
        <Button variant="ghost" size="sm" onClick={() => setConfirmBlock(true)} loading={loading === "block"}>
          Блокирай
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => run("unblock")} loading={loading === "unblock"}>
          Отблокирай
        </Button>
      )}
      <ConfirmDialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        onConfirm={() => run("block")}
        title="Блокиране на магазин?"
        message={`„${name}“ ще стане недостъпен публично и търговецът няма да може да го публикува, докато не бъде отблокиран. Данните се запазват.`}
        confirmLabel="Блокирай"
      />
    </div>
  );
}
