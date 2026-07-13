"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { deletePaymentAccount, savePaymentAccount } from "@/actions/payment-account";
import { Badge, Button, Card, ConfirmDialog, Drawer, InfoHint, Input } from "@/components/ui";
import type { ShopPaymentAccount } from "@/db";

/** Свързване на ePay акаунт (Модел А: парите отиват при търговеца). */
export function PaymentAccounts({ account }: { account: ShopPaymentAccount | null }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, action] = useActionState(savePaymentAccount, {} as { error?: string; ok?: boolean });

  /* Успешен запис → затвори drawer + toast. queueMicrotask: синхронен setState в
     effect чупи react-compiler lint-а (проектен паттерн). */
  useEffect(() => {
    if (!state.ok) return;
    queueMicrotask(() => setOpen(false));
    toast.success("Акаунтът е запазен.");
  }, [state.ok]);

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-ink-900">ePay.bg</p>
            {account ? <Badge tone="success">Свързан</Badge> : <Badge>Не е свързан</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-500">
            Карта онлайн — парите отиват директно при теб (не при платформата).
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant={account ? "secondary" : "primary"} onClick={() => setOpen(true)}>
            {account ? "Промени" : "Свържи"}
          </Button>
          {account && (
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
              Изтрий
            </Button>
          )}
        </div>
      </div>

      {open && (
        <Drawer open title="ePay — акаунт" onClose={() => setOpen(false)}>
          <form action={action} className="flex flex-col gap-4">
            <Input
              label="КИН (клиентски номер)"
              name="kin"
              required
              placeholder={account ? "•••• (запазен — въведи наново за промяна)" : ""}
              labelSuffix={
                <InfoHint
                  label="Клиентският идентификационен номер (КИН/MIN) от ePay акаунта на магазина. Намира се в профила ти в ePay.bg."
                  ariaLabel="Какво е КИН?"
                />
              }
            />
            <Input
              label="Тайна дума (secret)"
              name="secret"
              type="password"
              required
              placeholder={account ? "•••• (запазена)" : ""}
              labelSuffix={
                <InfoHint
                  label="Тайната дума за подписване на плащанията (SECRET word), задава се в ePay настройките за търговци. С нея ePay проверява, че заявката идва от теб."
                  ariaLabel="Каква тайна дума?"
                />
              }
            />
            {state.error && <p className="text-sm text-danger-600">{state.error}</p>}
            <div className="flex gap-2">
              <Button type="submit">Запази</Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Отказ
              </Button>
            </div>
          </form>
        </Drawer>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await deletePaymentAccount();
          toast.success("Акаунтът е премахнат.");
        }}
        title="Премахване на ePay"
        message="Купувачите вече няма да могат да плащат с карта. Сигурен ли си?"
        confirmLabel="Премахни"
      />
    </Card>
  );
}
