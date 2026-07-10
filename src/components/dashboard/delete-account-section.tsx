"use client";

import { useState } from "react";
import { deleteAccount } from "@/actions/account";
import { confirmNameMatches } from "@/lib/account-deletion";
import { Button, Card, Input, Modal } from "@/components/ui";

interface DeleteAccountSectionProps {
  shopName: string;
}

export function DeleteAccountSection({ shopName }: DeleteAccountSectionProps) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirmNameMatches(confirmName, shopName);

  function close() {
    if (submitting) return;
    setOpen(false);
    setConfirmName("");
    setError(null);
  }

  async function handleDelete() {
    if (!matches) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await deleteAccount({ confirmName });
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      // Твърдо пренасочване към landing — чисти клиентското състояние на изтрития акаунт.
      window.location.href = "/?deleted=1";
    } catch {
      setError("Изтриването не бе успешно. Опитай пак.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-danger-200">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-danger-700">Опасна зона</h2>
        <p className="text-sm text-ink-500">
          Изтриването на акаунта е необратимо. Всички продукти, поръчки и данни на
          магазина ще бъдат премахнати завинаги.
        </p>
      </div>
      <div>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Изтрий акаунта
        </Button>
      </div>

      <Modal
        open={open}
        onClose={close}
        title="Изтриване на акаунта"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={submitting}>
              Отказ
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={!matches}
              loading={submitting}
            >
              Разбирам, изтрий завинаги
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-ink-700">
            Действието е необратимо. За да потвърдиш, въведи точното име на магазина си:{" "}
            <strong className="text-ink-900">{shopName}</strong>
          </p>
          <Input
            label="Име на магазина"
            hideLabel
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="Име на магазина"
            autoComplete="off"
            error={error ?? undefined}
          />
        </div>
      </Modal>
    </Card>
  );
}
