"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { detectPlatform } from "@/lib/pwa-platform";
import { Icon, type IconName } from "@/components/ui";
import { Reveal } from "@/components/marketing/reveal";
import { InstallGuideModal } from "./install-guide-modal";

const BENEFITS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "rocket",
    title: "Мигновено",
    text: "Отваря се като истинско приложение — без адресна лента, без браузър.",
  },
  {
    icon: "bell",
    title: "Известия",
    text: "Веднага научаваш за нова поръчка, дори когато не си в сайта.",
  },
  {
    icon: "store",
    title: "Икона на екрана",
    text: "Един тап от началния екран — без да търсиш линк всеки път.",
  },
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
    <section className="mx-auto w-full max-w-7xl px-4 py-24">
      <Reveal>
        <div className="grid items-center gap-12 rounded-card border border-surface-200 bg-surface-0 p-8 shadow-card md:grid-cols-[1.1fr_0.9fr] md:p-12">
          {/* Текст + ползи */}
          <div className="flex flex-col items-start gap-6">
            <p className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
              <span className="shrink-0">Приложение</span>
              <span aria-hidden className="h-px w-16 bg-surface-200" />
            </p>
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-balance text-ink-900 sm:text-5xl">
              Frizmo винаги под ръка
            </h2>
            <p className="max-w-lg text-lg leading-relaxed text-ink-700">
              Добави Frizmo Shops на началния екран на телефона си — управлявай магазина
              и поръчките си като истинско приложение, за секунди.
            </p>
            <ul className="flex flex-col gap-4">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <Icon name={b.icon} size={20} />
                  </span>
                  <span>
                    <span className="block font-semibold text-ink-900">{b.title}</span>
                    <span className="block text-sm text-ink-500">{b.text}</span>
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
                className="inline-flex h-13 items-center gap-2 rounded-full bg-ink-900 px-7 text-base font-bold text-surface-0 shadow-card transition-transform hover:-translate-y-0.5"
              >
                Как да инсталирам
                <Icon name="chevron-down" size={18} className="-rotate-90" />
              </button>
            )}
          </div>

          {/* Визуал: телефон с иконата на приложението (home screen mock) */}
          <div className="flex justify-center">
            <div className="relative aspect-9/16 w-56 overflow-hidden rounded-[2.5rem] border-8 border-ink-900 bg-surface-50 shadow-float">
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
                <Image
                  src="/logo-mark.png"
                  alt="Иконата на Frizmo Shops"
                  width={72}
                  height={72}
                  className="rounded-[22%] shadow-card"
                />
                <span className="font-display text-base font-extrabold tracking-tight text-ink-900">
                  Frizmo <span className="text-ember-500">Shops</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <InstallGuideModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
