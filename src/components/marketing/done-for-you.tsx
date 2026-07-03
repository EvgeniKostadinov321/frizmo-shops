import { Icon } from "@/components/ui";

const PHONE_DISPLAY = "+359 87 716 7007";
const PHONE_HREF = "tel:+359877167007";
const EMAIL = "supportfrizmo@gmail.com";
const EMAIL_HREF =
  "mailto:supportfrizmo@gmail.com?subject=Искам сайт, настроен от вас";

/**
 * „Ние ще го направим за теб" — акцентна brand лента, която предлага
 * безплатна услуга по настройка на магазина за клиенти без време/умения.
 * Контакт: телефон и имейл (без социални мрежи).
 */
export function DoneForYou() {
  return (
    <section className="relative overflow-hidden bg-brand-surface" style={{ backgroundImage: "var(--gradient-cta)" }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
        style={{ backgroundImage: "var(--texture-noise)" }}
      />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-20">
        {/* Текст */}
        <div className="flex flex-col items-start gap-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-surface-ink/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-surface-muted">
            <Icon name="rocket" size={14} />
            Безплатна услуга
          </span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance text-brand-surface-ink sm:text-4xl">
            Нямаш време? Ние настройваме магазина ти — безплатно.
          </h2>
          <p className="max-w-lg text-lg leading-relaxed text-brand-surface-muted">
            Ако не ти се занимава с продукти, снимки и дизайн — само ни звънни. Екипът ни
            качва продуктите, подрежда витрината и публикува магазина вместо теб. Без
            допълнителна такса.
          </p>
        </div>

        {/* Контакт бутони — телефон и имейл */}
        <div className="flex flex-col gap-3">
          <a
            href={PHONE_HREF}
            className="group flex items-center gap-4 rounded-card bg-brand-surface-ink p-4 text-brand-surface shadow-float transition-transform hover:-translate-y-0.5"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <Icon name="phone" size={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-brand-surface/70">Обади се</span>
              <span className="block truncate font-display text-xl font-extrabold">
                {PHONE_DISPLAY}
              </span>
            </span>
          </a>
          <a
            href={EMAIL_HREF}
            className="group flex items-center gap-4 rounded-card border border-brand-surface-ink/20 p-4 text-brand-surface-ink transition-colors hover:bg-brand-surface-ink/10"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-surface-ink/15 text-brand-surface-ink">
              <Icon name="mail" size={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-brand-surface-muted">Или ни пиши</span>
              <span className="block truncate text-base font-semibold sm:text-lg">{EMAIL}</span>
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
