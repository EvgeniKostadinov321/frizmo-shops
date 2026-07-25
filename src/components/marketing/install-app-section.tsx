"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { m } from "motion/react";
import { detectPlatform } from "@/lib/pwa-platform";
import { Icon, type IconName } from "@/components/ui";
import { Reveal } from "@/components/marketing/reveal";
import { InstallGuideModal } from "./install-guide-modal";

const BENEFITS: { icon: IconName; title: string; text: string }[] = [
  { icon: "rocket", title: "Мигновено", text: "Като истинско приложение — без браузър." },
  { icon: "bell", title: "Известия", text: "Веднага научаваш за нова поръчка." },
  { icon: "store", title: "На екрана", text: "Едно натискане — без да търсиш линк." },
];

export function InstallAppSection() {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    /* setState синхронно в effect чупи react-compiler lint → queueMicrotask */
    queueMicrotask(() => setInstalled(p.isStandalone));
  }, []);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 md:py-24">
      <Reveal>
        <div className="grid items-center gap-8 rounded-card border border-surface-200 bg-surface-0 p-6 shadow-card md:grid-cols-[1.1fr_0.9fr] md:gap-12 md:p-12">
          {/* Текст + ползи */}
          <div className="flex flex-col items-start gap-5">
            <p className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
              <span className="shrink-0">Приложение</span>
              <span aria-hidden className="h-px w-16 bg-surface-200" />
            </p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance text-ink-900 sm:text-5xl">
              Frizmo винаги под ръка
            </h2>
            <p className="max-w-lg leading-relaxed text-ink-700 md:text-lg">
              Добави Frizmo Shops на началния екран — управлявай магазина си като истинско
              приложение.
            </p>
            {/* Ползи: компактна редица на мобилно, списък на десктоп */}
            <ul className="flex w-full flex-col gap-3">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <Icon name={b.icon} size={18} />
                  </span>
                  <span className="pt-0.5">
                    <span className="font-semibold text-ink-900">{b.title}</span>
                    <span className="text-sm text-ink-500"> — {b.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            {installed ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">
                <Icon name="check" size={16} />
                Приложението вече е инсталирано
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-ink-900 px-6 text-base font-bold text-surface-0 shadow-card transition-transform hover:-translate-y-0.5"
              >
                Как да инсталирам
                <Icon name="chevron-down" size={18} className="-rotate-90" />
              </button>
            )}
          </div>

          {/* Визуал: телефонът показва разказа — начален екран с Frizmo сред
              приложенията + пристигащо push известие (само десктоп) */}
          <div className="hidden justify-center md:flex">
            <div
              aria-hidden
              className="relative aspect-9/16 w-60 overflow-hidden rounded-[2.5rem] border-8 border-ink-900 bg-surface-100 shadow-float"
            >
              {/* Статус лента */}
              <div className="flex items-center justify-between px-5 pt-3 text-[10px] font-semibold text-ink-700">
                <span>9:41</span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-3 rounded-sm bg-ink-700/60" />
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-700/60" />
                </span>
              </div>

              {/* Push известието — слайдва отгоре при достигане на секцията */}
              <m.div
                initial={{ opacity: 0, y: -18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7, type: "spring", stiffness: 260, damping: 24 }}
                className="mx-3 mt-2 flex items-start gap-2.5 rounded-2xl border border-surface-200 bg-surface-0 p-3 shadow-float"
              >
                <Image
                  src="/logo-mark.png"
                  alt=""
                  width={28}
                  height={28}
                  className="size-7 shrink-0 rounded-lg"
                />
                <span className="min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-bold text-ink-900">Frizmo Shops</span>
                    <span className="shrink-0 text-[9px] text-ink-500">сега</span>
                  </span>
                  <span className="block text-[11px] leading-snug text-ink-700">
                    Нова поръчка — 47,00 € от Мария К.
                  </span>
                </span>
              </m.div>

              {/* Начален екран: ghost приложения + Frizmo с бадж */}
              <div className="mt-5 grid grid-cols-4 gap-x-3 gap-y-4 px-5">
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i} className="aspect-square rounded-xl bg-surface-200/80" />
                ))}
                <span className="relative">
                  <Image
                    src="/logo-mark.png"
                    alt=""
                    width={44}
                    height={44}
                    className="aspect-square w-full rounded-xl shadow-card"
                  />
                  <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-danger-600 text-[9px] font-bold text-white">
                    1
                  </span>
                </span>
              </div>
              <p className="mt-1.5 grid grid-cols-4 gap-x-3 px-5">
                <span className="col-start-4 text-center text-[8px] font-semibold text-ink-700">
                  Frizmo
                </span>
              </p>

              {/* Док */}
              <div className="absolute inset-x-4 bottom-3 flex justify-around rounded-2xl bg-surface-200/60 p-2.5">
                {Array.from({ length: 4 }, (_, i) => (
                  <span key={i} className="size-9 rounded-xl bg-surface-0/80" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <InstallGuideModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
