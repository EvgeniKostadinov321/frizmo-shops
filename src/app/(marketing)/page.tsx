import type { Metadata } from "next";
import { and, asc, eq, inArray } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { BeforeAfter } from "@/components/marketing/before-after";
import { DoneForYou } from "@/components/marketing/done-for-you";
import { FeatureBento } from "@/components/marketing/feature-bento";
import { HeroStorefrontDemo } from "@/components/marketing/hero-storefront-demo";
import { InstallAppButton } from "@/components/marketing/install-app-button";
import { InstallAppSection } from "@/components/marketing/install-app-section";
import { PricingCardSpotlight } from "@/components/marketing/pricing-card-spotlight";
import { Reveal } from "@/components/marketing/reveal";
import { RevealList } from "@/components/marketing/reveal-list";
import { ShopCard } from "@/components/marketing/shop-card";
import { StepCard, type StepVisual } from "@/components/marketing/step-card";
import { Accordion, Icon } from "@/components/ui";
import { db, products, shops } from "@/db";
import { DEMO_SHOP_SLUGS } from "@/lib/demo-shops";
import { publicImageUrl } from "@/lib/storage";
import { PRICING_PLANS, PRICING_TRUST, TRIAL_NOTE } from "@/lib/plans-content";

export const metadata: Metadata = {
  title: "Frizmo Shops — Продавай повече. Без хаос, без комисиони.",
  description:
    "Истински онлайн магазин със собствен адрес за минути: продукти, поръчки, наличности и видимост в Google. Без комисиона от продажбите. 30 дни безплатно.",
};

const STEPS: { number: string; title: string; text: string; visual: StepVisual }[] = [
  {
    number: "01",
    title: "Регистрирай се",
    text: "Име на магазина, категория — и си вътре. Без карта, без договори.",
    visual: "register",
  },
  {
    number: "02",
    title: "Добави продукти",
    text: "Снимки, цени, варианти (размер, цвят, разфасовка) — колкото ти трябват.",
    visual: "products",
  },
  {
    number: "03",
    title: "Избери визия",
    text: "Теми, твоите цветове, подреждаеми секции. Целият сайт се преоцветява с един клик.",
    visual: "theme",
  },
  {
    number: "04",
    title: "Публикувай",
    text: "Един клик — и магазинът е на живо. Сподели линка, клиентите поръчват веднага.",
    visual: "publish",
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
  /* Водещата ниша е home crafts — Ателие Глина (наследник на Ателие Ръчичка,
     решение 2026-07-03; демотата са тематичните от 2026-07-05) */
  const heroShop =
    demoShops.find((s) => s.slug === "atelie-glina") ?? demoShops[0] ?? null;
  const heroProducts = heroShop
    ? await db.query.products.findMany({
        where: and(eq(products.shopId, heroShop.id), eq(products.status, "active")),
        orderBy: [asc(products.createdAt)],
        limit: 6,
      })
    : [];
  /* Cover снимка за всяка демо карта — първата продуктова снимка на магазина.
     Един заявка за всички демо продукти, после мапваме първата снимка per магазин. */
  const demoShopIds = demoShops.map((s) => s.id);
  const demoProducts = demoShopIds.length
    ? await db.query.products.findMany({
        where: and(inArray(products.shopId, demoShopIds), eq(products.status, "active")),
        orderBy: [asc(products.createdAt)],
      })
    : [];
  const coverByShopId = new Map<string, string>();
  for (const product of demoProducts) {
    const path = product.images[0];
    if (path && !coverByShopId.has(product.shopId)) {
      coverByShopId.set(product.shopId, publicImageUrl(path));
    }
  }

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

      {/* Hero — full-bleed фон, заема (почти) целия екран на desktop за да диша.
          min-h компенсира плаващия хедър (~4.75rem), затова центрираме под него. */}
      <section
        className="relative flex items-center overflow-hidden lg:min-h-[calc(100svh-4.75rem)]"
        style={{ backgroundImage: "var(--gradient-hero-glow)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 mix-blend-overlay"
          style={{ backgroundImage: "var(--texture-noise)" }}
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-12 md:pt-16 lg:py-12">
          <div className="grid items-center gap-x-16 gap-y-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col items-start gap-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-surface-200 bg-surface-0 px-3.5 py-1.5 text-xs font-semibold text-ink-700 shadow-card">
                <span className="size-1.5 rounded-full bg-brand-600" aria-hidden />
                Направено за българските търговци
              </span>
              <h1 className="font-display text-5xl font-extrabold leading-[1.03] tracking-tight text-balance text-ink-900 sm:text-6xl lg:text-[4.5rem]">
                Продавай повече.
                <br />
                Без хаос, без{" "}
                <span className="relative whitespace-nowrap text-brand-600">
                  комисиони
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-1 -z-10 h-3 rounded-sm bg-brand-100"
                  />
                </span>
                .
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-ink-700">
                Истински онлайн магазин със собствен адрес — продукти, поръчки, наличности
                и клиенти, които те намират в Google. Спри да гониш поръчки из чатовете.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/auth/register"
                  className="group inline-flex h-13 items-center gap-2 rounded-full bg-ink-900 px-7 text-base font-bold text-surface-0 shadow-card transition-transform hover:-translate-y-0.5"
                >
                  Създай магазина си безплатно
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
                <InstallAppButton />
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-3 text-sm text-ink-500">
                {["30 дни безплатно", "Без карта", "Готов за 15 минути", "Без комисиона"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Icon name="check" size={15} className="shrink-0 text-brand-600" />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <HeroStorefrontDemo shop={heroShop} products={heroProducts} />
          </div>
        </div>
      </section>

      {/* „Ние ще го направим за теб" — безплатна услуга по настройка (акцентна лента) */}
      <DoneForYou />

      {/* Болката — „Преди / След" контраст (различен ритъм от картовите секции) */}
      <section className="bg-surface-100/60">
        <div className="mx-auto w-full max-w-7xl px-4 py-24">
          <div className="max-w-2xl">
            <Kicker>Познато ли ти е</Kicker>
            <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-balance text-ink-900 sm:text-5xl">
              Продаваш през Facebook и Viber?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-700">
              Всеки ден едни и същи въпроси в чата, изгубени поръчки и продукти, които
              никой не намира. Има по-добър начин.
            </p>
          </div>
          <Reveal className="mt-14">
            <BeforeAfter />
          </Reveal>
        </div>
      </section>

      {/* Как работи — стъпки с мини-визуализации и свързваща линия за прогрес */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24">
        <div className="max-w-2xl">
          <Kicker>Как работи</Kicker>
          <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-balance text-ink-900 sm:text-5xl">
            От нула до първата поръчка.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-700">
            Без код, без дизайнер, без чакане. Четири стъпки — и магазинът ти е на живо на
            твоя адрес във frizmoshops.bg.
          </p>
        </div>
        <RevealList className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
          {STEPS.map((step) => (
            <StepCard
              key={step.number}
              number={step.number}
              title={step.title}
              text={step.text}
              visual={step.visual}
            />
          ))}
        </RevealList>
      </section>

      {/* Витрина: живи демо магазини */}
      {demoShops.length > 0 && (
        <section className="bg-surface-100/60">
          <div className="mx-auto w-full max-w-7xl px-4 py-24">
            <Kicker>На живо</Kicker>
            <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
              Виж как изглежда на живо
            </h2>
            <p className="mt-3 text-lg text-ink-500">
              Три демо магазина, направени с Frizmo Shops — кликни и разгледай.
            </p>
            <RevealList className="mt-12 grid gap-6 md:grid-cols-3">
              {demoShops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} coverImage={coverByShopId.get(shop.id)} />
              ))}
            </RevealList>
            <p className="mt-10">
              <Link
                href="/shops"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Разгледай всички магазини в каталога
                <span aria-hidden>→</span>
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* Инсталирай като приложение (PWA) */}
      <InstallAppSection />

      {/* Функции — bento grid */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24">
        <div className="max-w-2xl">
          <Kicker>Какво получаваш</Kicker>
          <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-balance text-ink-900 sm:text-5xl">
            Всичко за онлайн продажбите — на едно място.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-700">
            Дизайн, поръчки и видимост в Google. Ти се грижиш за продуктите, останалото е
            наша работа.
          </p>
        </div>
        <Reveal className="mt-14">
          <FeatureBento />
        </Reveal>
      </section>

      {/* Цени */}
      <section id="pricing" className="bg-surface-100/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-24">
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
                <PricingCardSpotlight key={plan.id}>
                  <div
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
                    <div>
                      <p className={`font-display text-6xl font-extrabold ${dark ? "" : "text-ink-900"}`}>
                        {plan.priceMonthly} €
                        <span
                          className={`ml-1 font-sans text-base font-normal ${dark ? "text-brand-surface-muted" : "text-ink-500"}`}
                        >
                          / месец
                        </span>
                      </p>
                      <p
                        className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${dark ? "text-brand-surface-muted" : "text-brand-600"}`}
                      >
                        <Icon name="check" size={13} className="shrink-0" />
                        30 дни безплатно · без карта
                      </p>
                    </div>
                    <ul
                      className={`flex flex-col gap-2.5 text-sm ${dark ? "text-brand-surface-ink/90" : "text-ink-700"}`}
                    >
                      {"featuresLead" in plan && (
                        <li className={`pb-1 font-semibold ${dark ? "text-brand-surface-ink" : "text-ink-900"}`}>
                          {plan.featuresLead}
                        </li>
                      )}
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
                </PricingCardSpotlight>
              );
            })}
          </RevealList>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-ink-500">
            {PRICING_TRUST.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Icon name="check" size={15} className="shrink-0 text-brand-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ — split: заглавие + контакт карта вляво, акордеон вдясно */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Kicker>Въпроси</Kicker>
            <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-balance text-ink-900 sm:text-5xl">
              Често задавани въпроси
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-700">
              Отговорите на най-честите въпроси. Не намираш това, което търсиш?
            </p>
            <div className="mt-6 flex flex-col gap-3 rounded-card border border-surface-200 bg-surface-0 p-5 shadow-card">
              <p className="font-bold text-ink-900">Питай ни директно</p>
              <a
                href="tel:+359877167007"
                className="flex items-center gap-3 text-sm font-medium text-ink-700 transition-colors hover:text-brand-600"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon name="phone" size={16} />
                </span>
                +359 87 716 7007
              </a>
              <a
                href="mailto:supportfrizmo@gmail.com"
                className="flex items-center gap-3 text-sm font-medium text-ink-700 transition-colors hover:text-brand-600"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon name="mail" size={16} />
                </span>
                supportfrizmo@gmail.com
              </a>
            </div>
          </div>
          <div>
            <Accordion items={FAQ} />
          </div>
        </div>
      </section>

      {/* Финален CTA — снимка от демо магазин + тъмен scrim за четимост (спец §15) */}
      <section className="relative overflow-hidden bg-ink-900">
        <Image
          src="/cta-workshop.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          aria-hidden
        />
        {/* Тъмен scrim — четимост на центрирания текст върху всяка част от снимката */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgb(16 18 16 / 0.82), rgb(16 18 16 / 0.68) 50%, rgb(16 18 16 / 0.72))",
          }}
        />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-7 px-4 py-28 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-surface-200">
            Frizmo Shops
          </p>
          <h2 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            Първата ти поръчка е по-близо,
            <br className="hidden sm:block" /> отколкото мислиш.
          </h2>
          <p className="max-w-xl text-lg text-surface-200">
            Регистрирай се за 2 минути. Ако не ти хареса — просто спираш. {TRIAL_NOTE}
          </p>
          <Link
            href="/auth/register"
            className="group inline-flex h-13 items-center gap-2 rounded-full bg-white px-8 text-base font-bold text-ink-900 shadow-float transition-transform hover:-translate-y-0.5"
          >
            Създай магазина си сега
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
