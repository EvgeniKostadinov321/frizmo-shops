import { LinkButton } from "@/components/ui";
import { BeeMedallion } from "@/components/dashboard/bee-medallion";

/** Стъпките на пътя до жив магазин — огледало на реалния onboarding (магазин →
    продукт → публикуване). Показва на новия търговец какво предстои. */
const STEPS = [
  {
    number: "01",
    title: "Опиши магазина",
    text: "Име, категория, лого — основното, за да те намират клиентите.",
  },
  {
    number: "02",
    title: "Добави продукти",
    text: "Снимки, цени, варианти. Първият продукт може да е онлайн за минути.",
  },
  {
    number: "03",
    title: "Публикувай",
    text: "Един клик — и магазинът е на живо със собствен адрес. Споделяш линка.",
  },
];

/**
 * Първият екран след регистрация (търговец без магазин). „Момент на посрещане":
 * маскотът приветства, editorial заглавие + пътна карта от 3 стъпки, после CTA.
 * Само токени → работи в light + dark (dashboard зона). Заглавието се пази
 * дословно — e2e тестът разчита на него.
 */
export function DashboardWelcome() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col items-center justify-center gap-8 py-4 text-center">
      {/* Посрещане: маскот-медальон (видео loop) + заглавие */}
      <div className="flex flex-col items-center gap-5">
        <BeeMedallion className="size-40 sm:size-44" />
        <div className="flex flex-col items-center gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
            Добре дошъл във Frizmo Shops
          </p>
          <h1 className="text-balance font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
            Създай магазина си за 2 минути
          </h1>
          <p className="max-w-md text-pretty text-ink-700">
            Три кратки стъпки те делят от собствен онлайн магазин. Хайде да го
            направим заедно — всичко може да се променя по-късно.
          </p>
        </div>
      </div>

      {/* Пътна карта: 3 номерирани стъпки */}
      <ol className="grid w-full gap-4 text-left sm:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.number}
            className="flex flex-col gap-2 rounded-card border border-surface-200 bg-surface-0 p-5 shadow-card"
          >
            <span className="font-display text-3xl font-extrabold tracking-tight text-brand-500">
              {step.number}
            </span>
            <h2 className="font-display text-lg font-bold text-ink-900">{step.title}</h2>
            <p className="text-sm text-ink-500">{step.text}</p>
          </li>
        ))}
      </ol>

      <LinkButton size="lg" href="/dashboard/onboarding">
        Създай магазин
      </LinkButton>
    </div>
  );
}
