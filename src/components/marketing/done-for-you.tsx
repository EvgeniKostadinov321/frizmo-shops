import { Icon } from "@/components/ui";

const EMAIL = "supportfrizmo@gmail.com";
const EMAIL_HREF =
  "mailto:supportfrizmo@gmail.com?subject=Искам сайт, настроен от вас";

/**
 * „Ние ще го направим за теб" — акцентна brand лента, която предлага
 * безплатна услуга по настройка на магазина за клиенти без време/умения.
 * Контакт: имейл (без телефон и социални мрежи).
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
            Ако не ти се занимава с продукти, снимки и дизайн — само ни пиши. Екипът ни
            качва продуктите, подрежда витрината и публикува магазина вместо теб. Без
            допълнителна такса.
          </p>
        </div>

        {/* Контакт — имейлът е единственият канал */}
        <div className="flex flex-col gap-3">
          <a
            href={EMAIL_HREF}
            className="group flex items-center gap-4 rounded-card bg-brand-surface-ink p-5 text-brand-surface shadow-float transition-transform hover:-translate-y-0.5"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <Icon name="mail" size={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-brand-surface/70">Пиши ни на</span>
              <span className="block truncate font-display text-lg font-extrabold sm:text-xl">
                {EMAIL}
              </span>
            </span>
            <span
              aria-hidden
              className="ml-auto hidden shrink-0 text-brand-surface/70 transition-transform group-hover:translate-x-0.5 sm:block"
            >
              →
            </span>
          </a>
          <p className="text-center text-sm text-brand-surface-muted">
            Отговаряме до един работен ден.
          </p>
        </div>
      </div>
    </section>
  );
}
