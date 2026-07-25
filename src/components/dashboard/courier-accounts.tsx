"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteCourierAccount,
  saveCourierAccount,
  saveCourierDeliveryOption,
  testCourierConnection,
} from "@/actions/couriers";
import type { CourierDeliveryOption, ShopCourierAccount } from "@/db";
import { Badge, Button, Card, Checkbox, ConfirmDialog, Drawer, InfoHint, Input, PriceInput } from "@/components/ui";
import { centsToInput } from "@/lib/money";
import { AddressAutocomplete } from "./address-autocomplete";

type Provider = "econt" | "speedy";
type Target = "office" | "address";

interface ProviderMeta {
  id: Provider;
  name: string;
  hint: string;
  /** Къде търговецът получава API ключове (изисква договор с куриера). */
  keysHint: string;
  keysUrl: string;
  keysLabel: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: "econt",
    name: "Еконт",
    hint: "Потребител и парола от e-Econt акаунта.",
    keysHint:
      "За API достъп ти трябва договор с Еконт и активирана интеграция в e-Econt (Настройки → Интеграция).",
    keysUrl: "https://www.econt.com/business",
    keysLabel: "Еконт за бизнеса",
  },
  {
    id: "speedy",
    name: "Спиди",
    hint: "Потребител и парола от Speedy API акаунта.",
    keysHint:
      "За API достъп ти трябва договор със Спиди. Ключовете се заявяват от лицето за контакт по договора ти.",
    keysUrl: "https://www.speedy.bg/bg/business-clients",
    keysLabel: "Спиди за бизнеса",
  },
];

const TARGET_LABEL: Record<Target, string> = {
  office: "До офис на куриера",
  address: "До адрес на клиента",
};

interface Props {
  accounts: ShopCourierAccount[];
  deliveryOptions: CourierDeliveryOption[];
}

/** Таб „Куриери" — карта за Еконт + Спиди: ключове + подател + провери връзка +
    настройка на доставка (офис/адрес, резервна цена, праг безплатна) + изтрий. */
export function CourierAccounts({ accounts, deliveryOptions }: Props) {
  const router = useRouter();
  const byProvider = new Map(accounts.map((a) => [a.provider, a]));
  const optionFor = (provider: Provider, target: Target) =>
    deliveryOptions.find((o) => o.provider === provider && o.deliveryTarget === target) ?? null;
  const [editing, setEditing] = useState<Provider | null>(null);
  const [toDelete, setToDelete] = useState<Provider | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-500">
        Свържи куриерски акаунт, за да генерираш товарителници и да предлагаш доставка до
        офис с автоматична цена. Нужен е договор с куриера и API ключове (виж по-долу).
        Ключовете се пазят криптирано и не се показват след запис.
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

            {/* Насока откъде се вземат ключове — само за несвързан куриер (изисква договор). */}
            {!account && (
              <div className="rounded-card border border-surface-200 bg-surface-50 p-3 text-sm text-ink-500">
                <p>{p.keysHint}</p>
                <a
                  href={p.keysUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
                >
                  {p.keysLabel} ↗
                </a>
              </div>
            )}

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

            {/* Настройка на доставка — само за свързан куриер. Две опции (офис/адрес),
                всяка с резервна цена + праг за безплатна. Live цената идва от куриера. */}
            {account && (
              <div className="flex flex-col gap-3 border-t border-surface-200 pt-4">
                <p className="text-sm font-medium text-ink-700">Доставка с {p.name}</p>
                <p className="text-xs text-ink-500">
                  Цената се изчислява автоматично от {p.name} при поръчка. Резервната цена
                  се ползва само ако {p.name} не върне цена.
                </p>
                {(["office", "address"] as Target[]).map((target) => (
                  <DeliveryOptionForm
                    key={target}
                    provider={p.id}
                    target={target}
                    option={optionFor(p.id, target)}
                    courierName={p.name}
                    onSaved={() => router.refresh()}
                  />
                ))}
              </div>
            )}
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
  /* Град + адрес на подателя са контролирани, за да ги попълва address autocomplete-ът
     (HERE) наведнъж при избор — по-малко грешки от ръчно въвеждане. Формата е action-
     базирана, затова стойностите пътуват през hidden input-и. */
  const [senderCity, setSenderCity] = useState(account?.senderCity ?? "");
  const [senderAddress, setSenderAddress] = useState(account?.senderAddress ?? "");
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
        {/* Адрес с autocomplete (HERE): при избор попълва и адреса, и града наведнъж. */}
        <AddressAutocomplete
          value={senderAddress}
          onChange={setSenderAddress}
          onSelect={(result) => {
            setSenderAddress(result.fullAddress);
            if (result.city) setSenderCity(result.city);
          }}
        />
        <Input
          label="Град"
          value={senderCity}
          onChange={(e) => setSenderCity(e.target.value)}
          hint="Попълва се автоматично при избор на адрес."
          required
        />
        {/* Стойностите пътуват към action-а през hidden input-и (формата е action-базирана). */}
        <input type="hidden" name="senderCity" value={senderCity} />
        <input type="hidden" name="senderAddress" value={senderAddress} />
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

/**
 * Настройка на един вариант на куриерска доставка (офис ИЛИ адрес). Inline форма:
 * превключвател „предлагай", име в checkout, резервна цена, праг за безплатна.
 */
function DeliveryOptionForm({
  provider,
  target,
  option,
  courierName,
  onSaved,
}: {
  provider: Provider;
  target: Target;
  option: CourierDeliveryOption | null;
  courierName: string;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(option?.active ?? false);

  async function save(formData: FormData) {
    setSaving(true);
    try {
      formData.set("provider", provider);
      formData.set("deliveryTarget", target);
      formData.set("active", active ? "on" : "");
      const res = await saveCourierDeliveryOption({}, formData);
      if (!res.ok) {
        toast.error(res.error ?? "Провери въведените данни.");
        return;
      }
      toast.success("Настройката е запазена.");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const defaultName = option?.displayName || `${TARGET_LABEL[target]} (${courierName})`;

  return (
    <form action={save} className="flex flex-col gap-3 rounded-card border border-surface-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink-900">{TARGET_LABEL[target]}</span>
        <Checkbox
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          label="Предлагай"
        />
      </div>
      {active && (
        <>
          <Input
            label="Име в checkout"
            name="displayName"
            defaultValue={defaultName}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <PriceInput
              label="Резервна цена"
              name="fallbackPrice"
              defaultValue={centsToInput(option?.fallbackPriceCents ?? 0)}
              required
            />
            <PriceInput
              label="Безплатна над"
              name="freeOver"
              defaultValue={centsToInput(option?.freeOverCents ?? null)}
              hint="Празно = никога"
            />
          </div>
        </>
      )}
      <div>
        <Button type="submit" size="sm" loading={saving}>
          Запази
        </Button>
      </div>
    </form>
  );
}
