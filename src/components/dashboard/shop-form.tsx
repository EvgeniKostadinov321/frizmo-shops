"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ShopFormState } from "@/actions/shop";
import { AddressAutocomplete } from "./address-autocomplete";
import { WorkingHoursEditor } from "./working-hours-editor";
import { Button, Card, Input, Select, Textarea, Tabs, TabPanel, type TabItem } from "@/components/ui";
import { defaultWorkingDays, type WorkingDay } from "@/lib/working-hours";
import { BUSINESS_CATEGORIES } from "@/schemas/shop";

export interface ShopFormInitial {
  name?: string;
  businessCategory?: string;
  description?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  workingDays?: WorkingDay[];
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  viber?: string;
}

interface ShopFormProps {
  /** Създаването минава през `ShopWizard`; тази форма е за редакция. */
  mode?: "edit";
  initial?: ShopFormInitial;
  /** Публичният адрес на магазина — замразен след създаване (показва се read-only). */
  slug?: string;
  action: (prev: ShopFormState, formData: FormData) => Promise<ShopFormState>;
}

const categoryOptions = BUSINESS_CATEGORIES.map((c) => ({ value: c, label: c }));

export function ShopForm({ initial = {}, slug, action }: ShopFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [address, setAddress] = useState(initial.address ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [days, setDays] = useState<WorkingDay[]>(initial.workingDays ?? defaultWorkingDays());
  /* Формата смесва controlled (адрес/град/часове) и uncontrolled (defaultValue)
     полета → dirty се засича чрез native onInput/onChange на самия <form>
     (бълбука от всички полета). Нулира се след успешен запис. */
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (state.ok) {
      toast.success("Промените са запазени.");
      /* queueMicrotask: setState синхронно в effect чупи react-compiler lint. */
      queueMicrotask(() => setDirty(false));
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  /* Кой таб съдържа поле с грешка → marker точка. Панелите остават монтирани,
     затова FormData събира всички полета независимо кой таб е активен. */
  const fe = state.fieldErrors ?? {};
  const tabItems: TabItem[] = [
    {
      key: "basic",
      label: "Основни",
      marker: !!(fe.name || fe.businessCategory || fe.description),
    },
    {
      key: "contacts",
      label: "Контакти",
      marker: !!(fe.address || fe.city || fe.phone || fe.email),
    },
    {
      key: "social",
      label: "Социални",
      marker: !!(fe.facebook || fe.instagram || fe.tiktok || fe.youtube || fe.viber),
    },
  ];

  return (
    <Card>
      <form
        action={formAction}
        onInput={() => setDirty(true)}
        onChange={() => setDirty(true)}
        className="flex flex-col gap-4"
        noValidate
      >
        <input type="hidden" name="workingHours" value={JSON.stringify({ days })} />
        {slug && (
          <div className="rounded-control border border-surface-200 bg-surface-50 px-3 py-2.5">
            <p className="text-xs font-medium text-ink-500">Адрес на магазина</p>
            <p className="mt-0.5 text-sm font-medium text-ink-900">/s/{slug}</p>
            <p className="mt-1 text-xs text-ink-500">
              Адресът е постоянен и не се променя при смяна на името.
            </p>
          </div>
        )}

        <Tabs ariaLabel="Настройки на магазина" tabs={tabItems}>
          <TabPanel tabKey="basic">
            <div className="flex flex-col gap-4">
              <Input
                label="Име на магазина"
                name="name"
                required
                defaultValue={initial.name}
                error={state.fieldErrors?.name}
              />
              <Select
                label="Категория на бизнеса"
                name="businessCategory"
                required
                options={categoryOptions}
                placeholder="Избери категория"
                defaultValue={initial.businessCategory ?? ""}
                error={state.fieldErrors?.businessCategory}
              />
              <Textarea
                label="Описание"
                name="description"
                placeholder="С какво се занимава твоят бизнес?"
                defaultValue={initial.description}
                error={state.fieldErrors?.description}
              />
            </div>
          </TabPanel>

          <TabPanel tabKey="contacts">
            <div className="flex flex-col gap-4">
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onSelect={(result) => {
                  setAddress(result.fullAddress);
                  if (result.city) setCity(result.city);
                }}
                error={state.fieldErrors?.address}
              />
              <Input
                label="Град"
                name="city"
                value={city}
                onChange={(ev) => setCity(ev.target.value)}
                hint="Попълва се автоматично при избор на адрес."
                error={state.fieldErrors?.city}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Телефон"
                  name="phone"
                  type="tel"
                  placeholder="0888 123 456"
                  defaultValue={initial.phone}
                  error={state.fieldErrors?.phone}
                />
                <Input
                  label="Имейл за връзка"
                  name="email"
                  type="email"
                  defaultValue={initial.email}
                  error={state.fieldErrors?.email}
                />
              </div>
              <WorkingHoursEditor value={days} onChange={setDays} />
            </div>
          </TabPanel>

          <TabPanel tabKey="social">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Facebook"
                name="facebook"
                placeholder="https://facebook.com/..."
                defaultValue={initial.facebook}
                error={state.fieldErrors?.facebook}
              />
              <Input
                label="Instagram"
                name="instagram"
                placeholder="https://instagram.com/..."
                defaultValue={initial.instagram}
                error={state.fieldErrors?.instagram}
              />
              <Input
                label="TikTok"
                name="tiktok"
                placeholder="https://tiktok.com/@..."
                defaultValue={initial.tiktok}
                error={state.fieldErrors?.tiktok}
              />
              <Input
                label="YouTube"
                name="youtube"
                placeholder="https://youtube.com/@..."
                defaultValue={initial.youtube}
                error={state.fieldErrors?.youtube}
              />
              <Input
                label="Viber"
                name="viber"
                placeholder="Телефон или линк за Viber"
                defaultValue={initial.viber}
                error={state.fieldErrors?.viber}
                hint="Номер (напр. +359…) или линк viber://"
              />
            </div>
          </TabPanel>
        </Tabs>

        <div>
          <Button type="submit" loading={pending} disabled={!dirty}>
            Запази промените
          </Button>
        </div>
      </form>
    </Card>
  );
}
