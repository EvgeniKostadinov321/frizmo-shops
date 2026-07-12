"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateBuyerProfile } from "@/actions/buyer";
import { signOut } from "@/actions/auth";

const inputClass =
  "w-full rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 py-2.5 text-sm text-(--sf-text) outline-none focus:border-(--sf-primary)";

interface Props {
  fullName: string;
  phone: string;
}

/** Настройки на купувача: име/телефон + „Отвори магазин" + изход. */
export function SettingsForm({ fullName, phone }: Props) {
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
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-(--sf-text)">Име и фамилия</span>
          <input name="fullName" defaultValue={fullName} className={inputClass} required />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-(--sf-text)">Телефон</span>
          <input name="phone" defaultValue={phone} className={inputClass} required />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded-(--sf-radius) bg-(--sf-primary) px-4 py-2.5 text-sm font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Запазване…" : "Запази"}
        </button>
      </form>

      <div className="flex flex-col gap-3 border-t border-(--sf-border) pt-4">
        <a
          href="/dashboard/onboarding"
          className="text-sm font-medium text-(--sf-primary) hover:underline"
        >
          Искам да продавам — отвори магазин
        </a>
        <form action={signOut}>
          <button type="submit" className="text-sm text-(--sf-muted) hover:text-(--sf-text)">
            Изход
          </button>
        </form>
      </div>
    </div>
  );
}
