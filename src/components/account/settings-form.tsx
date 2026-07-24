"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateBuyerProfile } from "@/actions/buyer";
import { signOut } from "@/actions/auth";
import { DeleteAccount } from "@/components/account/delete-account";
import { DataExportButton } from "@/components/account/data-export-button";
import { exportBuyerData } from "@/actions/data-export";
import { Button, Input } from "@/components/ui";

/** Настройки на купувача (платформени): име/телефон + „Отвори магазин" + изход + изтриване. */
export function SettingsForm({ fullName, phone }: { fullName: string; phone: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true);
    try {
      const res = await updateBuyerProfile({
        fullName: formData.get("fullName"),
        phone: formData.get("phone"),
      });
      if (res.ok) {
        toast.success("Профилът е обновен.");
        router.refresh();
      } else toast.error(res.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <form action={submit} className="flex flex-col gap-4">
        <Input label="Име и фамилия" name="fullName" defaultValue={fullName} required />
        <Input label="Телефон" name="phone" defaultValue={phone} required />
        <Button type="submit" className="self-start" loading={busy}>
          Запази
        </Button>
      </form>
      <div className="flex flex-col gap-3 border-t border-surface-200 pt-4">
        <a href="/dashboard/onboarding" className="text-sm font-medium text-brand-600 hover:underline">
          Искам да продавам — отвори магазин
        </a>
        <form action={signOut.bind(null, "/")}>
          <button type="submit" className="text-sm text-ink-500 hover:text-ink-900">
            Изход
          </button>
        </form>
      </div>
      <div className="flex flex-col gap-2 rounded-card border border-surface-200 bg-surface-0 p-4">
        <div>
          <p className="font-medium text-ink-900">Моите данни</p>
          <p className="mt-1 text-sm text-ink-500">
            Изтегли копие на личните си данни (профил, поръчки, адреси, любими) в JSON формат.
          </p>
        </div>
        <DataExportButton action={exportBuyerData} filename="frizmo-моите-данни.json" />
      </div>
      <DeleteAccount />
    </div>
  );
}
