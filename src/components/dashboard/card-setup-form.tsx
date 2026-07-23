"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { getStripe } from "@/lib/stripe-client";
import { createSetupIntent } from "@/actions/card-setup";

/** Вътрешната форма — рендерира се в <Elements> с наличен clientSecret. */
function CardForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    const { error } = await stripe.confirmSetup({
      elements,
      redirect: "if_required", // без redirect за карта без 3DS; иначе Stripe пренасочва
    });
    if (error) {
      toast.error(error.message ?? "Картата не можа да се запази.");
      setBusy(false);
      return;
    }
    toast.success("Картата е запазена. Вече можеш да приемаш поръчки.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <Button type="submit" loading={busy} disabled={!stripe}>
        Запази картата
      </Button>
    </form>
  );
}

/**
 * Card-gate форма: зарежда SetupIntent (сървър), после Stripe Elements.
 * Показва се, когато магазинът има поне една завършена продажба, но без запазена карта.
 */
export function CardSetupForm() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function start() {
    setLoading(true);
    setError(false);
    const res = await createSetupIntent();
    if (!res.ok) {
      setError(true);
      setLoading(false);
      toast.error(res.error);
      return;
    }
    setClientSecret(res.data.clientSecret);
    setLoading(false);
  }

  if (!clientSecret) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-700">
          Имаш първа продажба. Запази карта, за да продължиш да приемаш поръчки — месечната
          такса се тегли автоматично от нея.
        </p>
        <Button loading={loading} onClick={start}>
          Добави карта
        </Button>
        {error && (
          <p className="text-sm text-danger-600">Нещо се обърка. Опитай пак.</p>
        )}
      </div>
    );
  }

  return (
    <Elements stripe={getStripe()} options={{ clientSecret }}>
      <CardForm />
    </Elements>
  );
}
