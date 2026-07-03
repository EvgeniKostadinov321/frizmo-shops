import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import Link from "next/link";
import { BrowserMockup } from "@/components/marketing/browser-mockup";
import {
  OrderNotificationMockup,
  ThemeEditorMockup,
  VisibilityMockup,
} from "@/components/marketing/feature-mockups";
import { ShopCard } from "@/components/marketing/shop-card";
import { Badge, FlagBg, Icon, type IconName, LinkButton } from "@/components/ui";
import { db, shops } from "@/db";
import { DEMO_SHOP_SLUGS } from "@/lib/demo-shops";
import { PRICING_PLANS, TRIAL_NOTE } from "@/lib/plans-content";

export const metadata: Metadata = {
  title: "Frizmo Shops — Твоят онлайн магазин. Готов днес. Без програмист.",
  description:
    "Създай собствен онлайн магазин за минути: продукти, поръчки, персонализиран дизайн и видимост в каталога. 14 дни безплатно.",
};

const PAINS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "message-circle",
    title: "Поръчки из съобщенията",
    text: "Facebook, Viber, Instagram... поръчките се губят между чатовете, а ти пишеш едно и също по 20 пъти на ден.",
  },
  {
    icon: "image",
    title: "Продуктите нямат дом",
    text: "Снимките потъват във feed-а за един ден. Няма цени, няма наличности, няма място, което да е ТВОЕ.",
  },
  {
    icon: "search",
    title: "Никой не те намира",
    text: "Без собствен сайт те няма в Google. Клиентите намират конкурентите, които са онлайн.",
  },
];

const STEPS = [
  { number: "1", title: "Регистрирай се", text: "Име на магазина, категория — и си вътре. Без карта, без договори." },
  { number: "2", title: "Добави продукти", text: "Снимки, цени, варианти (размер, цвят, разфасовка) — колкото ти трябват." },
  { number: "3", title: "Публикувай", text: "Избери дизайн, натисни „Публикувай“ и сподели линка. Клиентите поръчват веднага." },
];

const FEATURES: { icon: IconName; title: string; text: string; mockup: React.ReactNode }[] = [
  {
    icon: "palette",
    title: "Магазин, който изглежда като теб",
    text: "Теми, твоите цветове, твоето лого, подреждаеми секции — „за нас“, отзиви, галерия, промо банери. Личи си, че е твое, без ред код.",
    mockup: <ThemeEditorMockup />,
  },
  {
    icon: "bell",
    title: "Поръчките идват при теб",
    text: "Нова поръчка? Известие на телефона и имейл за секунди. Потвърждаваш, изпращаш, завършваш — наличностите се следят сами.",
    mockup: <OrderNotificationMockup />,
  },
  {
    icon: "trending-up",
    title: "Видимост от първия ден",
    text: "Магазинът ти е в каталога на Frizmo Shops и се индексира от Google. Клиентите те намират — не обратното.",
    mockup: <VisibilityMockup />,
  },
];

const FAQ = [
  { q: "Трябва ли ми фирма, за да продавам?", a: "За редовна търговска дейност — да (ЕООД, ЕТ или регистрация като земеделски производител/занаятчия). Ако тепърва проучваш, започни безплатния период и говори със счетоводител." },
  { q: "Как клиентите плащат?", a: "Наложен платеж, банков превод или на място — ти избираш кои методи предлагаш. Плащане с карта идва скоро." },
  { q: "Мога ли да откажа по всяко време?", a: "Да. Без договори и без неустойки — спираш абонамента и толкова." },
  { q: "Колко бързо мога да започна?", a: "Първият ти продукт може да е онлайн 10 минути след регистрацията. Сериозно." },
  { q: "Има ли комисиона от продажбите?", a: "Не. Плащаш само месечния абонамент — всичко от продажбите си е твое." },
];

export default async function LandingPage() {
  const demoShops = await db.query.shops.findMany({
    where: inArray(shops.slug, [...DEMO_SHOP_SLUGS]),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Frizmo Shops",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: "Платформа за създаване на онлайн магазини за българския пазар.",
            offers: { "@type": "Offer", price: "10", priceCurrency: "EUR" },
          }),
        }}
      />

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div className="flex flex-col items-start gap-5">
          <Badge tone="brand">
            <FlagBg className="mr-1.5 inline-block h-3 w-auto" />
            Създадено за българския пазар
          </Badge>
          <h1 className="text-4xl font-bold leading-tight text-ink-900 sm:text-5xl">
            Твоят онлайн магазин.
            <br />
            <span className="text-brand-600">Готов днес.</span>
            <br />
            Без програмист.
          </h1>
          <p className="max-w-md text-lg text-ink-700">
            Продукти, поръчки, красив дизайн и клиенти, които те намират — всичко на едно
            място, за цената на два кебапчета на ден.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <LinkButton href="/auth/register" size="lg">
              Създай магазина си безплатно
            </LinkButton>
            <Link href="/shops" className="text-sm font-medium text-ink-700 hover:text-ink-900">
              Виж живи магазини →
            </Link>
          </div>
          <p className="text-sm text-ink-500">{TRIAL_NOTE}</p>
        </div>
        <BrowserMockup />
      </section>

      {/* Болката */}
      <section className="border-y border-surface-200 bg-surface-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold text-ink-900">
            Продаваш през Facebook и Viber?
          </h2>
          <p className="mt-2 text-center text-ink-500">Знаем как изглежда денят ти.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PAINS.map((pain) => (
              <div key={pain.title} className="flex flex-col gap-3">
                <span className="flex size-11 items-center justify-center rounded-control bg-brand-100 text-brand-700">
                  <Icon name={pain.icon} size={22} />
                </span>
                <h3 className="font-bold text-ink-900">{pain.title}</h3>
                <p className="text-sm text-ink-700">{pain.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Как работи */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-ink-900">Как работи</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="flex flex-col gap-3 rounded-card border border-surface-200 bg-surface-0 p-6"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                {step.number}
              </span>
              <h3 className="font-bold text-ink-900">{step.title}</h3>
              <p className="text-sm text-ink-700">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Витрина: живи демо магазини */}
      {demoShops.length > 0 && (
        <section className="border-y border-surface-200 bg-surface-0">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="text-center text-3xl font-bold text-ink-900">
              Виж как изглежда на живо
            </h2>
            <p className="mt-2 text-center text-ink-500">
              Три демо магазина, направени с Frizmo Shops — кликни и разгледай.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {demoShops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Функции */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-16">
        {FEATURES.map((feature, i) => (
          <div key={feature.title} className="grid items-center gap-8 md:grid-cols-2">
            <div className={`flex flex-col gap-3 ${i % 2 ? "md:order-2" : ""}`}>
              <span className="flex size-11 items-center justify-center rounded-control bg-brand-100 text-brand-700">
                <Icon name={feature.icon} size={22} />
              </span>
              <h3 className="text-2xl font-bold text-ink-900">{feature.title}</h3>
              <p className="text-ink-700">{feature.text}</p>
            </div>
            <div className={i % 2 ? "md:order-1" : ""}>{feature.mockup}</div>
          </div>
        ))}
      </section>

      {/* Цени */}
      <section id="pricing" className="border-y border-surface-200 bg-surface-0">
        <div className="mx-auto w-full max-w-4xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold text-ink-900">Прости, честни цени</h2>
          <p className="mt-2 text-center text-ink-500">{TRIAL_NOTE} Без комисиони от продажби.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col gap-4 rounded-card border-2 bg-surface-0 p-6 ${
                  plan.highlighted ? "border-brand-600 shadow-lg" : "border-surface-200"
                }`}
              >
                {plan.highlighted && <Badge tone="brand">Най-популярен</Badge>}
                <div>
                  <h3 className="text-xl font-bold text-ink-900">{plan.name}</h3>
                  <p className="text-sm text-ink-500">{plan.description}</p>
                </div>
                <p className="text-4xl font-bold text-ink-900">
                  {plan.priceMonthly} €
                  <span className="text-base font-normal text-ink-500"> / месец</span>
                </p>
                <ul className="flex flex-col gap-2 text-sm text-ink-700">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Icon name="check" size={16} className="shrink-0 text-success-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <LinkButton
                  href="/auth/register"
                  variant={plan.highlighted ? "primary" : "secondary"}
                  className="mt-auto"
                >
                  Започни безплатно
                </LinkButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-ink-900">Често задавани въпроси</h2>
        <div className="mt-8 flex flex-col gap-2">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-card border border-surface-200 bg-surface-0 px-5 py-4"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-medium text-ink-900">
                {item.q}
                <Icon
                  name="chevron-down"
                  size={18}
                  className="shrink-0 text-ink-500 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pt-2 text-sm text-ink-700">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Финален CTA — brand-surface: дълбоко зелено и в двата режима, без неон */}
      <section className="bg-linear-to-br from-brand-surface to-brand-surface-deep">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 px-4 py-20 text-center">
          <h2 className="text-3xl font-bold text-brand-surface-ink">
            Първата ти поръчка е по-близо, отколкото мислиш.
          </h2>
          <p className="max-w-xl text-brand-surface-muted">
            Регистрирай се за 2 минути. Ако не ти хареса — просто спираш. {TRIAL_NOTE}
          </p>
          <Link
            href="/auth/register"
            className="inline-flex h-12 items-center rounded-control bg-brand-surface-ink px-6 text-base font-bold text-brand-surface shadow-lg transition-opacity hover:opacity-90"
          >
            Създай магазина си сега
          </Link>
        </div>
      </section>
    </>
  );
}
