"use client";

import { m } from "motion/react";
import { Icon } from "@/components/ui";
import { fadeUp, staggerContainer } from "@/lib/motion";

/*
 * „Преди / След" v2 — ТЪМНИЯТ момент на страницата (секцията зад него е
 * brand-surface). Чат хаосът се разиграва: съобщенията се появяват едно по
 * едно при скрол (stagger), после светлият магазин „изгрява" отдясно.
 * Reduced-motion: MotionConfig изключва transform частта централно.
 */

const CHAT_MESSAGES = [
  { text: "Имате ли го в синьо, размер М?", mine: false },
  { text: "Да, 25 лв 🙂", mine: true },
  { text: "А доставка до Варна? И имате ли отстъпка за 2 бр?", mine: false },
  { text: "Момент…", mine: true, typing: true },
];

function ChatBubble({ text, mine, typing }: { text: string; mine: boolean; typing?: boolean }) {
  return (
    <m.span
      variants={fadeUp}
      className={
        mine
          ? "ml-auto w-fit max-w-[75%] rounded-xl rounded-br-sm bg-brand-surface-ink/15 px-3 py-2 text-right text-[13px] text-brand-surface-ink"
          : "w-fit max-w-[80%] rounded-xl rounded-bl-sm bg-brand-surface-deep px-3 py-2 text-[13px] text-brand-surface-ink/80"
      }
    >
      {text}
      {typing && (
        <span aria-hidden className="ml-1.5 inline-flex gap-0.5 align-middle">
          {[0, 0.2, 0.4].map((delay) => (
            <m.span
              key={delay}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay }}
              className="size-1 rounded-full bg-brand-surface-muted"
            />
          ))}
        </span>
      )}
    </m.span>
  );
}

export function BeforeAfter() {
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
      {/* ПРЕДИ — хаосът в чатовете (по-дълбок тъмен панел върху тъмната секция) */}
      <div className="flex flex-col gap-4 rounded-card border border-brand-surface-ink/10 bg-brand-surface-ink/5 p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-surface-ink/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-surface-muted">
            Сега
          </span>
          <span className="text-sm font-medium text-brand-surface-muted">Продаваш през чатове</span>
        </div>

        {/* Съобщенията се появяват едно по едно при достигане на секцията */}
        <m.div
          aria-hidden
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer(0.45, 0.2)}
          className="flex flex-col gap-2 py-2"
        >
          {CHAT_MESSAGES.map((msg) => (
            <ChatBubble key={msg.text} text={msg.text} mine={msg.mine} typing={msg.typing} />
          ))}
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

      {/* СЛЕД — светлината в тъмното: магазинът „изгрява" след чата */}
      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainer(0.3, 1.2)}
        className="flex flex-col gap-4 rounded-card bg-surface-0 p-6 shadow-float sm:p-8"
      >
        <m.div variants={fadeUp} className="flex items-center gap-2">
          <span className="rounded-full bg-brand-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-700">
            С Frizmo
          </span>
          <span className="text-sm font-medium text-ink-500">Твоят собствен магазин</span>
        </m.div>

        {/* Мини витрина — ред продукт с цена и бутон „Поръчай" */}
        <div aria-hidden className="flex flex-col gap-2 py-2">
          <m.div
            variants={fadeUp}
            className="flex items-center gap-3 rounded-xl border border-surface-200 bg-surface-50 p-2.5"
          >
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
          </m.div>
          <m.div
            variants={fadeUp}
            className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-[12px] text-brand-700"
          >
            <Icon name="check" size={14} className="shrink-0" />
            Поръчка приета — наличността се обнови сама
          </m.div>
        </div>

        <m.ul variants={fadeUp} className="mt-auto flex flex-col gap-2.5 text-sm text-ink-700">
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
        </m.ul>
      </m.div>
    </div>
  );
}
