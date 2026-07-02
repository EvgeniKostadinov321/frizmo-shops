"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import type { ShopFormState } from "@/actions/shop";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { BUSINESS_CATEGORIES } from "@/schemas/shop";

export interface ShopFormInitial {
  name?: string;
  businessCategory?: string;
  description?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  workingHoursText?: string;
  facebook?: string;
  instagram?: string;
}

interface ShopFormProps {
  mode: "create" | "edit";
  initial?: ShopFormInitial;
  action: (prev: ShopFormState, formData: FormData) => Promise<ShopFormState>;
}

const categoryOptions = BUSINESS_CATEGORIES.map((c) => ({ value: c, label: c }));

export function ShopForm({ mode, initial = {}, action }: ShopFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const isCreate = mode === "create";

  useEffect(() => {
    if (state.ok) toast.success("Промените са запазени.");
    if (state.error) toast.error(state.error);
  }, [state]);

  const detailFields = (
    <div className="flex flex-col gap-4">
      <Input
        label="Град"
        name="city"
        defaultValue={initial.city}
        error={state.fieldErrors?.city}
      />
      <Input
        label="Адрес"
        name="address"
        defaultValue={initial.address}
        error={state.fieldErrors?.address}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Телефон"
          name="phone"
          type="tel"
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
      <Textarea
        label="Работно време"
        name="workingHoursText"
        rows={2}
        placeholder={"Пон–Пет: 9:00–18:00\nСъбота: 9:00–14:00"}
        defaultValue={initial.workingHoursText}
        error={state.fieldErrors?.workingHoursText}
      />
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
      </div>
    </div>
  );

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <Input
          label="Име на магазина"
          name="name"
          defaultValue={initial.name}
          error={state.fieldErrors?.name}
          hint={isCreate ? "От името се създава публичният адрес на магазина." : undefined}
        />
        <Select
          label="Категория на бизнеса"
          name="businessCategory"
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

        {isCreate ? (
          <details className="rounded-control border border-surface-200 p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink-700">
              Още детайли (град, контакти, работно време) — по избор
            </summary>
            <div className="pt-4">{detailFields}</div>
          </details>
        ) : (
          detailFields
        )}

        {state.error && <p className="text-sm text-danger-600">{state.error}</p>}
        <div>
          <Button type="submit" loading={pending}>
            {isCreate ? "Създай магазина" : "Запази промените"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
