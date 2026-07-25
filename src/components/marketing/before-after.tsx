"use client";

import Image from "next/image";
import { m } from "motion/react";
import { Icon } from "@/components/ui";
import { fadeUp, staggerContainer } from "@/lib/motion";

/*
 * „Преди / След" v3 — ТЪМНИЯТ момент на страницата.
 * Ляво: 3 ЗАСТЪПЕНИ чат прозореца (различни приложения, непрочетени баджове,
 * висящи въпроси) — хаосът е осезаем. Дясно: таблото на Frizmo с реална
 * продуктова снимка — поръчката идва готова, наличността се следи сама.
 * Прозорците се появяват един по един при скрол (stagger).
 */

/** Мини чат прозорец: заглавна лента на приложение + бадж непрочетени + съобщения. */
function ChatWindow({
  app,
  unread,
  rotate,
  offset,
  children,
}: {
  app: string;
  unread: number;
  /** Лека ротация в градуси — „нахвърляни" прозорци. */
  rotate: string;
  /** Хоризонтално отместване + застъпване на предишния прозорец. */
  offset?: string;
  children: React.ReactNode;
}) {
  return (
    <m.div
      variants={fadeUp}
      className={`relative w-full max-w-xs rounded-xl border border-brand-surface-ink/10 bg-brand-surface-deep shadow-float ${rotate} ${offset ?? ""}`}
    >
      <div className="flex items-center justify-between rounded-t-xl border-b border-brand-surface-ink/10 bg-brand-surface-ink/10 px-3 py-2">
        <span className="text-[11px] font-bold text-brand-surface-ink">{app}</span>
        <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger-600 px-1 text-[9px] font-bold text-white">
          {unread}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 p-3">{children}</div>
    </m.div>
  );
}

/** Реплика на клиент: аватар-инициал + балонче + час. */
function CustomerLine({ initial, text, time }: { initial: string; text: string; time: string }) {
  return (
    <div className="flex items-end gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-surface-ink/15 text-[10px] font-bold text-brand-surface-ink">
        {initial}
      </span>
      <span className="rounded-xl rounded-bl-sm bg-brand-surface-ink/8 px-2.5 py-1.5 text-[12px] leading-snug text-brand-surface-ink/85">
        {text}
      </span>
      <span className="shrink-0 pb-0.5 text-[9px] text-brand-surface-muted">{time}</span>
    </div>
  );
}

export function BeforeAfter() {
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
      {/* ПРЕДИ — купчината чатове */}
      <div className="flex flex-col gap-4 rounded-card border border-brand-surface-ink/10 bg-brand-surface-ink/5 p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-surface-ink/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-surface-muted">
            Сега
          </span>
          <span className="text-sm font-medium text-brand-surface-muted">Продаваш през чатове</span>
        </div>

        {/* Трите „нахвърляни" прозореца — появяват се един по един */}
        <m.div
          aria-hidden
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer(0.4, 0.2)}
          className="flex flex-col items-start py-2"
        >
          <ChatWindow app="Messenger" unread={34} rotate="-rotate-2">
            <CustomerLine initial="А" text="Имате ли го в синьо, размер М?" time="вт" />
            <span className="ml-8 w-fit rounded-full bg-danger-600/15 px-2 py-0.5 text-[10px] font-semibold text-danger-600">
              Без отговор от 2 дни
            </span>
          </ChatWindow>

          <ChatWindow app="Viber" unread={12} rotate="rotate-1" offset="-mt-4 ml-6 sm:ml-10">
            <CustomerLine initial="М" text="А доставка до Варна? И отстъпка за 2 бр?" time="10:42" />
            <span className="ml-8 flex w-fit items-center gap-1.5 rounded-xl rounded-br-sm bg-brand-surface-ink/15 px-2.5 py-1.5 text-[12px] text-brand-surface-ink">
              Момент…
              <span className="flex gap-0.5">
                {[0, 0.2, 0.4].map((delay) => (
                  <m.span
                    key={delay}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay }}
                    className="size-1 rounded-full bg-brand-surface-muted"
                  />
                ))}
              </span>
            </span>
          </ChatWindow>

          <ChatWindow app="Instagram" unread={7} rotate="-rotate-1" offset="-mt-4 ml-2 sm:ml-4">
            <CustomerLine initial="И" text="Колко струва кошницата? Свободна ли е?" time="сега" />
          </ChatWindow>
        </m.div>

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
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-surface-ink/10 text-brand-surface-ink">
          <Icon name="chevron-down" size={20} className="md:-rotate-90" />
        </span>
      </div>

      {/* СЛЕД — таблото на Frizmo: поръчката идва готова */}
      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainer(0.35, 1.3)}
        className="flex flex-col gap-4 rounded-card bg-surface-0 p-6 shadow-float sm:p-8"
      >
        <m.div variants={fadeUp} className="flex items-center gap-2">
          <span className="rounded-full bg-brand-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">
            С Frizmo
          </span>
          <span className="text-sm font-medium text-ink-500">Поръчките идват готови</span>
        </m.div>

        {/* Мини табло: ред поръчка с реална снимка + потвърждение */}
        <div aria-hidden className="flex flex-col gap-2 py-2">
          <m.div
            variants={fadeUp}
            className="rounded-xl border border-surface-200 bg-surface-50 p-3"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-ink-500">Поръчка #0043 · Мария П. · Пловдив</span>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 font-semibold text-brand-700">
                Нова
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <Image
                src="/landing/hero-basket.webp"
                alt=""
                width={44}
                height={44}
                className="size-11 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink-900">
                  Плетена кошница от ракита
                </p>
                <p className="text-[13px] font-bold text-ink-900">45,00 €</p>
              </div>
              <span className="rounded-full bg-brand-600 px-3 py-1.5 text-[11px] font-bold text-white">
                Потвърди
              </span>
            </div>
          </m.div>
          <m.div
            variants={fadeUp}
            className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-[12px] text-brand-700"
          >
            <Icon name="check" size={14} className="shrink-0" />
            Адрес, телефон и количество — попълнени. Наличност: 5 → 4, сама.
          </m.div>
        </div>

        <m.ul variants={fadeUp} className="mt-auto flex flex-col gap-2.5 text-sm text-ink-700">
          {[
            "Цени, наличности и варианти на едно място",
            "Известие на телефона за секунди",
            "Собствен адрес, видим в Google",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand-600" />
              {item}
            </li>
          ))}
        </m.ul>
      </m.div>
    </div>
  );
}
