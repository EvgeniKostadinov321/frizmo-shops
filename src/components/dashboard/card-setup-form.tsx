"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { getStripe } from "@/lib/stripe-client";
import { createSetupIntent, setDefaultCard } from "@/actions/card-setup";

/** Вътрешната форма — рендерира се в <Elements> с наличен clientSecret. */
function CardForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    console.log("[CARD] 1. submit влезе | stripe:", !!stripe, "| elements:", !!elements);
    if (!stripe || !elements) {
      console.log("[CARD] ✗ stripe или elements липсва — spinner НЕ се пуска");
      return;
    }
    setBusy(true);

    try {
      /* Timeout guard: ако elements.submit() или confirmSetup висят >25с, показваме го
         явно (иначе spinner виси безкрайно без следа). */
      const withTimeout = <T,>(p: Promise<T>, label: string): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, rej) =>
            setTimeout(() => rej(new Error(`TIMEOUT: ${label} не резолвна за 25с`)), 25000),
          ),
        ]);

      console.log("[CARD] 2. извиквам elements.submit()...");
      const submitRes = await withTimeout(elements.submit(), "elements.submit");
      console.log("[CARD] 3. elements.submit() върна:", JSON.stringify(submitRes));
      if (submitRes.error) {
        console.log("[CARD] ✗ submit грешка:", submitRes.error.type, submitRes.error.message);
        toast.error(submitRes.error.message ?? "Провери данните на картата.");
        setBusy(false);
        return;
      }

      console.log("[CARD] 4. извиквам confirmSetup() | return_url:", `${window.location.origin}/dashboard/billing`);
      const confirmRes = await withTimeout(
        stripe.confirmSetup({
          elements,
          confirmParams: { return_url: `${window.location.origin}/dashboard/billing` },
          redirect: "if_required",
        }),
        "confirmSetup",
      );
      console.log("[CARD] 5. confirmSetup() върна:", JSON.stringify({
        error: confirmRes.error
          ? { type: confirmRes.error.type, code: confirmRes.error.code, message: confirmRes.error.message }
          : null,
        setupIntent: confirmRes.setupIntent
          ? { status: confirmRes.setupIntent.status, id: confirmRes.setupIntent.id }
          : null,
      }));

      if (confirmRes.error) {
        console.log("[CARD] ✗ confirmSetup грешка:", confirmRes.error.type, confirmRes.error.code, confirmRes.error.message);
        toast.error(confirmRes.error.message ?? "Картата не можа да се запази.");
        setBusy(false);
        return;
      }
      console.log("[CARD] 6. confirmSetup успя — задавам default карта...");
      /* КЛЮЧОВО: задаваме картата като default_payment_method (confirmSetup само я записва,
         не я прави default). Без това card-gate никога не пада. */
      const setupIntentId = confirmRes.setupIntent?.id;
      if (setupIntentId) {
        const defRes = await setDefaultCard(setupIntentId);
        console.log("[CARD] 7. setDefaultCard:", defRes.ok ? "✓ default зададен" : "✗ " + defRes.error);
        if (!defRes.ok) {
          toast.error(defRes.error);
          setBusy(false);
          return;
        }
      }
      console.log("[CARD] 8. ✓ ГОТОВО — картата запазена + default");
      setBusy(false);
      toast.success("Картата е запазена. Вече можеш да приемаш поръчки.");
      router.refresh();
    } catch (err) {
      /* Хваща TIMEOUT + всякакъв неочакван throw, който иначе би оставил spinner-а завинаги. */
      console.error("[CARD] ✗✗ НЕОЧАКВАНА ГРЕШКА/THROW:", err);
      toast.error(err instanceof Error ? err.message : "Възникна грешка при запазване на картата.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* SetupIntent е само карта (виж createSetupIntent). Stripe Link е изключен —
          не ни трябва за запазване на карта за таксата и усложнява потока (Email/Mobile
          полета + виси на localhost). */}
      <PaymentElement options={{ layout: "tabs", wallets: { link: "never" } }} />
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
