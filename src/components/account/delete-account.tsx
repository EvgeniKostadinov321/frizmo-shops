"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteBuyerAccount } from "@/actions/buyer";
import { Button, Input } from "@/components/ui";

/** Изтриване на купувачки акаунт — потвърждение с думата „ИЗТРИЙ". */
export function DeleteAccount() {
  const router = useRouter();
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-card border border-danger-600/30 bg-surface-0 p-4">
      <div>
        <p className="font-medium text-ink-900">Изтриване на акаунт</p>
        <p className="mt-1 text-sm text-ink-500">
          Данните ти се изтриват. Миналите поръчки остават при търговците (анонимизирани). Напиши
          „ИЗТРИЙ“ за потвърждение.
        </p>
      </div>
      <Input
        label="Потвърждение"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="ИЗТРИЙ"
      />
      <Button
        variant="danger"
        size="sm"
        className="self-start"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await deleteBuyerAccount({ confirm: word });
            if (res.ok) {
              toast.success("Акаунтът е изтрит.");
              router.push("/");
            } else toast.error(res.error);
          } finally {
            setBusy(false);
          }
        }}
      >
        Изтрий акаунта
      </Button>
    </div>
  );
}
