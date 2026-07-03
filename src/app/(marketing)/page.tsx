import type { Metadata } from "next";
import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import {
  OrderNotificationMockup,
  ThemeEditorMockup,
  VisibilityMockup,
} from "@/components/marketing/feature-mockups";
import { PhoneMockup } from "@/components/marketing/phone-mockup";
import { Reveal } from "@/components/marketing/reveal";
import { NicheMarquee } from "@/components/marketing/niche-marquee";
import { RevealList } from "@/components/marketing/reveal-list";
import { SpringIconBadge } from "@/components/marketing/spring-icon-badge";
import { ShopCard } from "@/components/marketing/shop-card";
import { Accordion, FlagBg, Icon, type IconName } from "@/components/ui";
import { db, products, shops } from "@/db";
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
  {
    number: "01",
    title: "Регистрирай се",
    text: "Име на магазина, категория — и си вътре. Без карта, без договори.",
  },
  {
    number: "02",
    title: "Добави продукти",
    text: "Снимки, цени, варианти (размер, цвят, разфасовка) — колкото ти трябват.",
  },
  {
    number: "03",
    title: "Избери визия",
    text: "Теми, твоите цветове, подреждаеми секции. Целият сайт се преоцветява с един клик.",
  },
  {
    number: "04",
    title: "Публикувай",
    text: "Един клик — и магазинът е на живо. Сподели линка, клиентите поръчват веднага.",
  },
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
  { value: "company", question: "Трябва ли ми фирма, за да продавам?", answer: "За редовна търговска дейност — да (ЕООД, ЕТ или регистрация като земеделски производител/занаятчия). Ако тепърва проучваш, започни безплатния период и говори със счетоводител." },
  { value: "payment", question: "Как клиентите плащат?", answer: "Наложен платеж, банков превод или на място — ти избираш кои методи предлагаш. Плащане с карта идва скоро." },
  { value: "cancel", question: "Мога ли да откажа по всяко време?", answer: "Да. Без договори и без неустойки — спираш абонамента и толкова." },
  { value: "speed", question: "Колко бързо мога да започна?", answer: "Първият ти продукт може да е онлайн 10 минути след регистрацията. Сериозно." },
  { value: "commission", question: "Има ли комисиона от продажбите?", answer: "Не. Плащаш само месечния абонамент — всичко от продажбите си е твое." },
];

/** Letterspaced editorial kicker с hairline продължение. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
      <span className="shrink-0">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-surface-200" />
    </p>
  );
}

export default async function LandingPage() {
  const demoShops = await db.query.shops.findMany({
    where: inArray(shops.slug, [...DEMO_SHOP_SLUGS]),
  });
  const heroShop = demoShops.find((s) => s.slug === DEMO_SHOP_SLUGS[0]) ?? null;
  const heroProducts = heroShop
    ? await db.query.products.findMany({
        where: and(eq(products.shopId, heroShop.id), eq(products.status, "active")),
        orderBy: [asc(products.createdAt)],
        limit: 6,
      })
    : [];

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          }),
        }}
      />

      {/* Hero — топла хартия с фин brand glow + noise (спец §15) */}
      <section
        className="relative mx-auto w-full max-w-6xl overflow-hidden px-4 pb-20 pt-10 md:pt-14"
        style={{ backgroundImage: "var(--gradient-hero-glow)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 mix-blend-overlay"
          style={{ backgroundImage: "var(--texture-noise)" }}
        />
        <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
          <span className="flex shrink-0 items-center gap-2">
            <FlagBg className="h-3 w-auto" />
            Създадено за българския пазар
          </span>
          <span aria-hidden className="h-px flex-1 bg-surface-200" />
          <span className="hidden shrink-0 sm:block">Без комисиони · 24/7</span>
        </div>

        <div className="mt-10 grid items-center gap-14 md:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col items-start gap-7">
            <h1 className="font-display text-6xl font-extrabold leading-[0.95] tracking-tight text-ink-900 sm:text-7xl lg:text-8xl">
              Твоят онлайн{" "}
              <span className="bg-linear-to-r from-ember-500 to-ember-600 bg-clip-text text-transparent">
                магазин
              </span>
              .
              <br />
              Готов днес.
              <br />
              Без програмист.
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-ink-700">
              Продукти, поръчки, красив дизайн и клиенти, които те намират — всичко на
              едно място, за цената на два кебапчета на ден.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/auth/register"
                className="group inline-flex h-13 items-center gap-2 rounded-full bg-ink-900 px-7 text-base font-bold text-surface-0 shadow-card transition-transform hover:-translate-y-0.5"
              >
                Създай магазина си безплатно
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
              <Link
                href="/shops"
                className="inline-flex h-13 items-center rounded-full border border-surface-200 bg-surface-0 px-6 text-sm font-medium text-ink-700 transition-colors hover:border-surface-300 hover:text-ink-900"
              >
                Виж живи магазини
              </Link>
            </div>
            <p className="flex items-center gap-2 text-sm text-ink-500">
              <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
              {TRIAL_NOTE}
            </p>
          </div>

          <Reveal>
            <PhoneMockup shop={heroShop} products={heroProducts} />
          </Reveal>
        </div>
      </section>

      {/* Ниши marquee — социално доказателство (спец §14) */}
      <NicheMarquee />

      {/* Болката — по-дълбока хартия */}
      <section className="bg-surface-100/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-24">
          <Kicker>Познато ли ти е</Kicker>
          <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
            Продаваш през Facebook и Viber?
          </h2>
          <p className="mt-3 text-lg text-ink-500">Знаем как изглежда денят ти.</p>
          <RevealList className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-3">
            {PAINS.map((pain) => (
              <div key={pain.title} className="flex flex-col gap-4 border-t border-surface-200 pt-6">
                  <SpringIconBadge name={pain.icon} />
                  <h3 className="text-lg font-bold text-ink-900">{pain.title}</h3>
                  <p className="text-[15px] leading-relaxed text-ink-700">{pain.text}</p>
              </div>
            ))}
          </RevealList>
        </div>
      </section>

      {/* Как работи — editorial номериран списък */}
      <section className="mx-auto grid w-full max-w-6xl gap-14 px-4 py-24 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Kicker>Как работи</Kicker>
          <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
            От нула до първата поръчка.
          </h2>
          <p className="mt-4 max-w-sm text-lg leading-relaxed text-ink-500">
            Без код, без дизайнер, без чакане. Четири стъпки — и магазинът ти е на
            живо на твоя адрес във frizmoshops.bg.
          </p>
        </div>
        <div className="flex flex-col">
          {STEPS.map((step, i) => (
            <Reveal key={step.number} delay={i * 0.07}>
              <div className="grid grid-cols-[3.5rem_1fr] gap-5 border-t border-surface-200 py-7 last:pb-0">
                <span className="font-display text-3xl font-extrabold text-brand-600/70">
                  {step.number}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-ink-900">{step.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-ink-700">{step.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Витрина: живи демо магазини */}
      {demoShops.length > 0 && (
        <section className="bg-surface-100/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-24">
            <Kicker>На живо</Kicker>
            <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
              Виж как изглежда на живо
            </h2>
            <p className="mt-3 text-lg text-ink-500">
              Три демо магазина, направени с Frizmo Shops — кликни и разгледай.
            </p>
            <RevealList className="mt-12 grid gap-6 md:grid-cols-3">
              {demoShops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </RevealList>
          </div>
        </section>
      )}

      {/* Функции */}
      <section className="mx-auto w-full max-w-6xl px-4 py-24">
        <Kicker>Какво получаваш</Kicker>
        <div className="mt-12 flex flex-col gap-24">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title}>
              <div className="grid items-center gap-10 md:grid-cols-2">
                <div className={`flex flex-col gap-4 ${i % 2 ? "md:order-2" : ""}`}>
                  <SpringIconBadge name={feature.icon} />
                  <h3 className="font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                    {feature.title}
                  </h3>
                  <p className="max-w-md text-lg leading-relaxed text-ink-700">{feature.text}</p>
                </div>
                <div className={i % 2 ? "md:order-1" : ""}>{feature.mockup}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Цени */}
      <section id="pricing" className="bg-surface-100/60">
        <div className="mx-auto w-full max-w-5xl px-4 py-24">
          <Kicker>Цени</Kicker>
          <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
            Прости, честни цени
          </h2>
          <p className="mt-3 text-lg text-ink-500">
            {TRIAL_NOTE} Без комисиони от продажби.
          </p>
          <RevealList className="mt-12 grid gap-6 md:grid-cols-2" itemClassName="h-full">
            {PRICING_PLANS.map((plan) => {
              const dark = plan.highlighted;
              return (
                  <div
                    key={plan.id}
                    className={`flex h-full flex-col gap-6 rounded-card p-8 ${
                      dark
                        ? "bg-linear-to-br from-brand-surface to-brand-surface-deep text-brand-surface-ink [box-shadow:var(--shadow-brand-tint),var(--shadow-float)]"
                        : "border border-surface-200 bg-surface-0 shadow-card"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className={`font-display text-2xl font-extrabold ${dark ? "" : "text-ink-900"}`}>
                          {plan.name}
                        </h3>
                        <p className={`mt-1 text-sm ${dark ? "text-brand-surface-muted" : "text-ink-500"}`}>
                          {plan.description}
                        </p>
                      </div>
                      {dark && (
                        <span className="rounded-full bg-brand-surface-ink/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
                          Най-популярен
                        </span>
                      )}
                    </div>
                    <p className={`font-display text-6xl font-extrabold ${dark ? "" : "text-ink-900"}`}>
                      {plan.priceMonthly} €
                      <span
                        className={`ml-1 font-sans text-base font-normal ${dark ? "text-brand-surface-muted" : "text-ink-500"}`}
                      >
                        / месец
                      </span>
                    </p>
                    <ul
                      className={`flex flex-col gap-2.5 text-sm ${dark ? "text-brand-surface-ink/90" : "text-ink-700"}`}
                    >
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2.5">
                          <Icon
                            name="check"
                            size={15}
                            className={`shrink-0 ${dark ? "text-brand-surface-muted" : "text-brand-600"}`}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/auth/register"
                      className={`mt-auto inline-flex h-12 items-center justify-center rounded-full text-sm font-bold transition-transform hover:-translate-y-0.5 ${
                        dark
                          ? "bg-brand-surface-ink text-brand-surface"
                          : "bg-ink-900 text-surface-0"
                      }`}
                    >
                      Започни безплатно
                    </Link>
                  </div>
              );
            })}
          </RevealList>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-4 py-24">
        <Kicker>Въпроси</Kicker>
        <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-ink-900">
          Често задавани въпроси
        </h2>
        <div className="mt-10">
          <Accordion items={FAQ} />
        </div>
      </section>

      {/* Финален CTA — единствената тъмнозелена лента (bookend) */}
      <section className="relative overflow-hidden" style={{ backgroundImage: "var(--gradient-cta)" }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
          style={{ backgroundImage: "var(--texture-noise)" }}
        />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-7 px-4 py-24 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-surface-muted">
            Frizmo Shops
          </p>
          <h2 className="font-display text-4xl font-extrabold tracking-tight text-brand-surface-ink sm:text-6xl">
            Първата ти поръчка е по-близо,
            <br className="hidden sm:block" /> отколкото мислиш.
          </h2>
          <p className="max-w-xl text-lg text-brand-surface-muted">
            Регистрирай се за 2 минути. Ако не ти хареса — просто спираш. {TRIAL_NOTE}
          </p>
          <Link
            href="/auth/register"
            className="group inline-flex h-13 items-center gap-2 rounded-full bg-brand-surface-ink px-8 text-base font-bold text-brand-surface shadow-float transition-transform hover:-translate-y-0.5"
          >
            Създай магазина си сега
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
