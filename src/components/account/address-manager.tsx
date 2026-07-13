"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/actions/buyer";
import { Button, Checkbox, ConfirmDialog, Drawer, Input } from "@/components/ui";
import type { BuyerAddress } from "@/db";

/** Адресна книга (платформена): списък + drawer форма + изтриване/основен. */
export function AddressManager({ addresses }: { addresses: BuyerAddress[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BuyerAddress | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    try {
      const res = await saveAddress(
        {
          label: formData.get("label"),
          receiverName: formData.get("receiverName"),
          receiverPhone: formData.get("receiverPhone"),
          city: formData.get("city"),
          address: formData.get("address"),
          isDefault: formData.get("isDefault") === "on",
        },
        editing?.id,
      );
      if (res.ok) {
        toast.success(editing ? "Адресът е обновен." : "Адресът е запазен.");
        setDrawerOpen(false);
        router.refresh();
      } else toast.error(res.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        size="sm"
        className="self-start"
        onClick={() => {
          setEditing(null);
          setDrawerOpen(true);
        }}
      >
        Добави адрес
      </Button>
      {addresses.length === 0 ? (
        <p className="rounded-card border border-surface-200 bg-surface-0 p-6 text-center text-sm text-ink-500">
          Още нямаш запазени адреси.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-card border border-surface-200 bg-surface-0 p-4"
            >
              <div className="min-w-0 text-sm">
                <p className="font-medium text-ink-900">
                  {a.label || a.receiverName}
                  {a.isDefault && (
                    <span className="ml-2 text-xs font-normal text-brand-600">· основен</span>
                  )}
                </p>
                <p className="mt-0.5 text-ink-500">
                  {a.receiverName} · {a.receiverPhone}
                </p>
                <p className="text-ink-500">
                  {a.courierOfficeName || [a.address, a.city].filter(Boolean).join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(a);
                    setDrawerOpen(true);
                  }}
                  className="text-brand-600 hover:underline"
                >
                  Редактирай
                </button>
                {!a.isDefault && (
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await setDefaultAddress(a.id);
                      if (r.ok) router.refresh();
                      else toast.error(r.error);
                    }}
                    className="text-ink-500 hover:text-ink-900"
                  >
                    Основен
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmId(a.id)}
                  className="text-danger-600 hover:underline"
                >
                  Изтрий
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? "Редактирай адрес" : "Нов адрес"}
      >
        <form action={submit} className="flex flex-col gap-4">
          <Input label="Етикет (по избор)" name="label" defaultValue={editing?.label ?? ""} placeholder="Вкъщи" />
          <Input label="Име на получателя" name="receiverName" defaultValue={editing?.receiverName ?? ""} required />
          <Input label="Телефон" name="receiverPhone" defaultValue={editing?.receiverPhone ?? ""} required />
          <Input label="Град" name="city" defaultValue={editing?.city ?? ""} />
          <Input label="Адрес" name="address" defaultValue={editing?.address ?? ""} />
          <Checkbox name="isDefault" defaultChecked={editing?.isDefault ?? false} label="Основен адрес" />
          <Button type="submit" loading={busy}>
            Запази
          </Button>
        </form>
      </Drawer>
      <ConfirmDialog
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={async () => {
          if (!confirmId) return;
          const r = await deleteAddress(confirmId);
          setConfirmId(null);
          if (r.ok) {
            toast.success("Адресът е изтрит.");
            router.refresh();
          } else toast.error(r.error);
        }}
        title="Изтриване на адрес"
        message="Сигурен ли си, че искаш да изтриеш този адрес?"
        confirmLabel="Изтрий"
      />
    </div>
  );
}
