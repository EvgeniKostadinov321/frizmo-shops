"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/actions/buyer";
import { ConfirmDialog, Drawer } from "@/components/ui";
import type { BuyerAddress } from "@/db";

const inputClass =
  "w-full rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 py-2.5 text-sm text-(--sf-text) outline-none focus:border-(--sf-primary)";

/** Адресна книга на купувача: списък + добавяне/редакция в drawer + изтриване/основен. */
export function AddressManager({ addresses }: { addresses: BuyerAddress[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BuyerAddress | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openNew() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEdit(a: BuyerAddress) {
    setEditing(a);
    setDrawerOpen(true);
  }

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
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={openNew}
        className="self-start rounded-(--sf-radius) bg-(--sf-primary) px-4 py-2 text-sm font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90"
      >
        Добави адрес
      </button>

      {addresses.length === 0 ? (
        <p className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-6 text-center text-sm text-(--sf-muted)">
          Още нямаш запазени адреси.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4"
            >
              <div className="min-w-0 text-sm">
                <p className="font-medium text-(--sf-text)">
                  {a.label || a.receiverName}
                  {a.isDefault && (
                    <span className="ml-2 text-xs font-normal text-(--sf-primary)">· основен</span>
                  )}
                </p>
                <p className="mt-0.5 text-(--sf-muted)">
                  {a.receiverName} · {a.receiverPhone}
                </p>
                <p className="text-(--sf-muted)">
                  {a.courierOfficeName || [a.address, a.city].filter(Boolean).join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                <button
                  type="button"
                  onClick={() => openEdit(a)}
                  className="text-(--sf-primary) hover:underline"
                >
                  Редактирай
                </button>
                {!a.isDefault && (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await setDefaultAddress(a.id);
                      if (res.ok) router.refresh();
                      else toast.error(res.error);
                    }}
                    className="text-(--sf-muted) hover:text-(--sf-text)"
                  >
                    Основен
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmId(a.id)}
                  className="text-(--sf-accent) hover:underline"
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
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-(--sf-text)">Етикет (по избор)</span>
            <input name="label" defaultValue={editing?.label ?? ""} className={inputClass} placeholder="Вкъщи" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-(--sf-text)">Име на получателя</span>
            <input name="receiverName" defaultValue={editing?.receiverName ?? ""} className={inputClass} required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-(--sf-text)">Телефон</span>
            <input name="receiverPhone" defaultValue={editing?.receiverPhone ?? ""} className={inputClass} required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-(--sf-text)">Град</span>
            <input name="city" defaultValue={editing?.city ?? ""} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-(--sf-text)">Адрес</span>
            <input name="address" defaultValue={editing?.address ?? ""} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-sm text-(--sf-text)">
            <input type="checkbox" name="isDefault" defaultChecked={editing?.isDefault ?? false} />
            Основен адрес
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-(--sf-radius) bg-(--sf-primary) px-4 py-2.5 text-sm font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Запазване…" : "Запази"}
          </button>
        </form>
      </Drawer>

      <ConfirmDialog
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={async () => {
          if (!confirmId) return;
          const res = await deleteAddress(confirmId);
          setConfirmId(null);
          if (res.ok) {
            toast.success("Адресът е изтрит.");
            router.refresh();
          } else {
            toast.error(res.error);
          }
        }}
        title="Изтриване на адрес"
        message="Сигурен ли си, че искаш да изтриеш този адрес?"
        confirmLabel="Изтрий"
      />
    </div>
  );
}
