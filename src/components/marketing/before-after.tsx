import { Icon } from "@/components/ui";

/**
 * „Преди / След" контраст за секцията „Болка": вляво хаосът от чатове
 * (тъмен, претрупан панел), вдясно чистото решение (светъл магазин).
 * Различен ритъм от картовите секции — чист CSS/токени.
 */
export function BeforeAfter() {
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
      {/* ПРЕДИ — хаосът в чатовете (тъмен панел) */}
      <div className="flex flex-col gap-4 rounded-card bg-brand-surface p-6 shadow-float sm:p-8">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-surface-ink/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-surface-muted">
            Сега
          </span>
          <span className="text-sm font-medium text-brand-surface-muted">Продаваш през чатове</span>
        </div>

        {/* Струпани, застъпващи се съобщения — усещане за хаос */}
        <div aria-hidden className="relative flex flex-col gap-2 py-2">
          <span className="w-4/5 rounded-xl rounded-bl-sm bg-brand-surface-deep px-3 py-2 text-[13px] text-brand-surface-ink/80">
            Имате ли го в синьо, размер М?
          </span>
          <span className="ml-auto w-2/3 rounded-xl rounded-br-sm bg-brand-surface-ink/15 px-3 py-2 text-right text-[13px] text-brand-surface-ink">
            Да, 25 лв 🙂
          </span>
          <span className="w-3/4 rounded-xl rounded-bl-sm bg-brand-surface-deep px-3 py-2 text-[13px] text-brand-surface-ink/80">
            А доставка до Варна? И имате ли отстъпка за 2 бр?
          </span>
          <span className="ml-auto w-1/2 rounded-xl rounded-br-sm bg-brand-surface-ink/15 px-3 py-2 text-right text-[13px] text-brand-surface-ink">
            Момент…
          </span>
        </div>

        <ul className="mt-auto flex flex-col gap-2.5 text-sm text-brand-surface-muted">
          {[
            "Едни и същи въпроси по 20 пъти на ден",
            "Поръчки, изгубени между чатовете",
            "Никаква следа в Google — клиентите не те намират",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Icon name="x" size={16} className="mt-0.5 shrink-0 text-danger-600" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Стрелка между двете (вертикална на mobile) */}
      <div className="flex items-center justify-center py-2 md:py-0">
        <span className="flex size-11 items-center justify-center rounded-full border border-surface-200 bg-surface-0 text-brand-600 shadow-card">
          <Icon name="chevron-down" size={20} className="md:-rotate-90" />
        </span>
      </div>

      {/* СЛЕД — чистото решение (светъл магазин) */}
      <div className="flex flex-col gap-4 rounded-card border border-surface-200 bg-surface-0 p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">
            С Frizmo
          </span>
          <span className="text-sm font-medium text-ink-500">Твоят собствен магазин</span>
        </div>

        {/* Мини витрина — ред продукт с цена и бутон „Поръчай" */}
        <div aria-hidden className="flex flex-col gap-2 py-2">
          <div className="flex items-center gap-3 rounded-xl border border-surface-200 bg-surface-50 p-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-100 text-brand-600">
              <Icon name="image" size={17} />
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-[13px] font-semibold text-ink-900">Плетена чанта — синя</span>
              <span className="text-[13px] font-bold text-ink-900">25,00 €</span>
            </div>
            <span className="rounded-full bg-brand-600 px-3 py-1.5 text-[11px] font-bold text-white">
              Поръчай
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-[12px] text-brand-700">
            <Icon name="check" size={14} className="shrink-0" />
            Поръчка приета — наличността се обнови сама
          </div>
        </div>

        <ul className="mt-auto flex flex-col gap-2.5 text-sm text-ink-700">
          {[
            "Цени, наличности и варианти на едно място",
            "Поръчките идват готови, с известие",
            "Собствен адрес, видим в Google",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand-600" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
