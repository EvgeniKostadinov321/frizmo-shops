"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteCourierAccount,
  saveCourierAccount,
  testCourierConnection,
} from "@/actions/couriers";
import type { ShopCourierAccount } from "@/db";
import { Badge, Button, Card, ConfirmDialog, Drawer, InfoHint, Input } from "@/components/ui";

type Provider = "econt" | "speedy";

const PROVIDERS: { id: Provider; name: string; hint: string }[] = [
  { id: "econt", name: "Еконт", hint: "Потребител и парола от e-Econt акаунта." },
  { id: "speedy", name: "Спиди", hint: "Потребител и парола от Speedy API акаунта." },
];

interface Props {
  accounts: ShopCourierAccount[];
}

/** Таб „Куриери" — карта за Еконт + Спиди: ключове + подател + провери връзка + изтрий. */
export function CourierAccounts({ accounts }: Props) {
  const router = useRouter();
  const byProvider = new Map(accounts.map((a) => [a.provider, a]));
  const [editing, setEditing] = useState<Provider | null>(null);
  const [toDelete, setToDelete] = useState<Provider | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-500">
        Свържи куриерски акаунт, за да генерираш товарителници и да предлагаш доставка до
        офис. Ключовете се пазят криптирано и не се показват след запис.
      </p>

      {PROVIDERS.map((p) => {
        const account = byProvider.get(p.id);
        return (
          <Card key={p.id} className="flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-ink-900">{p.name}</h3>
                  {account ? (
                    <Badge tone="success">Свързан</Badge>
                  ) : (
                    <Badge tone="neutral">Не е свързан</Badge>
                  )}
                </div>
                <p className="text-sm text-ink-500">{p.hint}</p>
                {account && (
                  <p className="text-sm text-ink-500">
                    Подател: {account.senderName || "—"} · {account.senderCity || "—"}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(p.id)}>
                {account ? "Промени" : "Свържи"}
              </Button>
              {account && (
                <>
                  <TestButton provider={p.id} />
                  <Button variant="ghost" size="sm" onClick={() => setToDelete(p.id)}>
                    Изтрий
                  </Button>
                </>
              )}
            </div>
          </Card>
        );
      })}

      {editing && (
        <CourierDrawer
          provider={editing}
          account={byProvider.get(editing) ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Изтриване на куриер"
        message="Наистина ли да премахна този куриерски акаунт? Свързаните методи ще станат ръчни."
        confirmLabel="Изтрий"
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteCourierAccount(toDelete);
          toast.success("Куриерът е премахнат.");
          setToDelete(null);
          router.refresh();
        }}
      />
    </div>
  );
}

/** Бутон „Провери връзка" — вика testCourierConnection и показва резултата. */
function TestButton({ provider }: { provider: Provider }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await testCourierConnection(provider);
          if (res.ok) toast.success("Връзката с куриера е успешна.");
          else toast.error(res.error ?? "Връзката не бе успешна.");
        } finally {
          setBusy(false);
        }
      }}
    >
      Провери връзка
    </Button>
  );
}

function CourierDrawer({
  provider,
  account,
  onClose,
  onSaved,
}: {
  provider: Provider;
  account: ShopCourierAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const name = provider === "econt" ? "Еконт" : "Спиди";
  /* Пояснения за API креденшълите — това НЕ е обикновен вход, а достъп до API-то
     на куриера (различен от паролата за уебсайта им). */
  const usernameHint =
    provider === "econt"
      ? "Потребителското име за интеграция от e-Econt (Настройки → Интеграция / API). Различно е от логина за сайта на Еконт."
      : "Потребителят за Speedy API — заявява се от api.registration@speedy.bg (не е паролата за онлайн клиента на Спиди).";
  const passwordHint =
    provider === "econt"
      ? "Паролата (или токенът) към същия e-Econt API достъп. С нея генерираме товарителници от твое име."
      : "Паролата/токенът към Speedy API акаунта. С нея генерираме товарителници от твое име.";

  async function save(formData: FormData) {
    setSaving(true);
    try {
      formData.set("provider", provider);
      const res = await saveCourierAccount({}, formData);
      if (!res.ok) {
        toast.error(res.error ?? "Провери въведените данни.");
        return;
      }
      toast.success("Куриерът е запазен.");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open title={`${name} — акаунт`} onClose={onClose}>
      <form action={save} className="flex flex-col gap-4">
        <Input
          label="Потребител"
          name="username"
          autoComplete="off"
          required
          placeholder={account ? "•••• (запазен — въведи наново за промяна)" : ""}
          labelSuffix={<InfoHint label={usernameHint} ariaLabel="Какво е това потребителско име?" />}
        />
        <Input
          label="Парола / токен"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder={account ? "•••• (запазен)" : ""}
          labelSuffix={<InfoHint label={passwordHint} ariaLabel="Каква парола/токен?" />}
        />
        <div className="h-px bg-surface-200" />
        <p className="text-sm font-medium text-ink-700">Данни на подателя (за товарителницата)</p>
        <Input label="Име" name="senderName" defaultValue={account?.senderName ?? ""} required />
        <Input label="Телефон" name="senderPhone" defaultValue={account?.senderPhone ?? ""} required />
        <Input label="Град" name="senderCity" defaultValue={account?.senderCity ?? ""} required />
        <Input label="Адрес" name="senderAddress" defaultValue={account?.senderAddress ?? ""} required />
        <div className="flex gap-2">
          <Button type="submit" loading={saving}>
            Запази
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отказ
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
