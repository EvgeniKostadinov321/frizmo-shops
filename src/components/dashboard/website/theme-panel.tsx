"use client";

import { useId } from "react";
import { Icon } from "@/components/ui";
import { THEME_PALETTES } from "@/lib/site-recipes";
import { THEME_LABELS, THEME_META, THEME_PRESETS } from "@/lib/themes";
import {
  HEADER_VARIANTS,
  THEMES,
  type SiteSettings,
  type ThemeId,
} from "@/schemas/site-settings";

type HeaderVariant = (typeof HEADER_VARIANTS)[number];

/** Мета за header variant picker-а: етикет + кратко описание + мини-скица. */
const HEADER_VARIANT_META: Record<
  HeaderVariant,
  { label: string; hint: string; sketch: React.ReactNode }
> = {
  1: {
    label: "Класически",
    hint: "Лого вляво, меню вдясно",
    sketch: (
      <span className="flex items-center justify-between px-1.5">
        <span className="h-1.5 w-4 rounded-full bg-current opacity-80" />
        <span className="flex gap-0.5">
          <span className="h-1 w-2.5 rounded-full bg-current opacity-40" />
          <span className="h-1 w-2.5 rounded-full bg-current opacity-40" />
          <span className="h-1 w-2.5 rounded-full bg-current opacity-40" />
        </span>
      </span>
    ),
  },
  2: {
    label: "Разделен",
    hint: "Лого в центъра, меню отдвете страни",
    sketch: (
      <span className="flex items-center justify-center gap-1.5 px-1.5">
        <span className="flex gap-0.5">
          <span className="h-1 w-2 rounded-full bg-current opacity-40" />
          <span className="h-1 w-2 rounded-full bg-current opacity-40" />
        </span>
        <span className="h-1.5 w-4 rounded-full bg-current opacity-80" />
        <span className="flex gap-0.5">
          <span className="h-1 w-2 rounded-full bg-current opacity-40" />
          <span className="h-1 w-2 rounded-full bg-current opacity-40" />
        </span>
      </span>
    ),
  },
  3: {
    label: "Минимал",
    hint: "Лого + меню-бутон",
    sketch: (
      <span className="flex items-center justify-between px-1.5">
        <span className="h-1.5 w-4 rounded-full bg-current opacity-80" />
        <span className="flex flex-col gap-0.5">
          <span className="h-0.5 w-2.5 rounded-full bg-current opacity-60" />
          <span className="h-0.5 w-2.5 rounded-full bg-current opacity-60" />
          <span className="h-0.5 w-2.5 rounded-full bg-current opacity-60" />
        </span>
      </span>
    ),
  },
};

interface ThemePanelProps {
  settings: SiteSettings;
  onChange: (patch: Partial<SiteSettings>) => void;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-medium text-ink-900">
        {label}
      </label>
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-16 cursor-pointer rounded-control border border-surface-300 bg-surface-0 p-1"
      />
    </div>
  );
}

export function ThemePanel({ settings, onChange }: ThemePanelProps) {
  const lightThemes = THEMES.filter((t) => !THEME_META[t].isDark);
  const darkThemes = THEMES.filter((t) => THEME_META[t].isDark);

  function ThemeButton({ theme }: { theme: ThemeId }) {
    const preset = THEME_PRESETS[theme];
    const active = settings.theme === theme;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onChange({ theme })}
        title={THEME_META[theme].tagline}
        className={`flex flex-col gap-1.5 rounded-control border-2 p-2 text-left transition-colors ${
          active ? "border-brand-600" : "border-surface-200 hover:border-surface-300"
        }`}
      >
        <span
          className="h-10 w-full rounded"
          style={{ background: preset["--sf-bg"], border: `1px solid ${preset["--sf-border"]}` }}
        >
          <span
            className="mx-2 mt-2 block h-2 w-1/2 rounded-full"
            style={{ background: settings.primaryColor }}
          />
          <span
            className="mx-2 mt-1 block h-1.5 w-3/4 rounded-full"
            style={{ background: preset["--sf-border"] }}
          />
        </span>
        <span className="text-xs font-medium text-ink-900">{THEME_LABELS[theme]}</span>
      </button>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-500">
            Светли
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {lightThemes.map((theme) => (
              <ThemeButton key={theme} theme={theme} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-500">
            Тъмни
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {darkThemes.map((theme) => (
              <ThemeButton key={theme} theme={theme} />
            ))}
          </div>
        </div>
      </div>

      {/* Палитрите са курирани per тема (същите като в wizard-а) — смяната на
          темата показва нейните комбинации, текущите цветове не се пипат. */}
      <div>
        <p className="mb-2 text-sm font-medium text-ink-900">Цветова комбинация</p>
        <p className="mb-2 text-xs text-ink-500">
          Подбрани за тема „{THEME_LABELS[settings.theme]}“.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {THEME_PALETTES[settings.theme].map((palette) => {
            const active =
              settings.primaryColor === palette.primary &&
              settings.accentColor === palette.accent;
            return (
              <button
                key={palette.name}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange({ primaryColor: palette.primary, accentColor: palette.accent })
                }
                className={`flex items-center gap-2 rounded-control border-2 p-2 text-left transition-colors ${
                  active ? "border-brand-600" : "border-surface-200 hover:border-surface-300"
                }`}
              >
                <span className="flex shrink-0 -space-x-1">
                  <span
                    className="size-5 rounded-full border-2 border-surface-0"
                    style={{ background: palette.primary }}
                  />
                  <span
                    className="size-5 rounded-full border-2 border-surface-0"
                    style={{ background: palette.accent }}
                  />
                </span>
                <span className="truncate text-xs font-medium text-ink-900">{palette.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <details className="rounded-control border border-surface-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-ink-700">
          Собствени цветове
        </summary>
        <div className="flex flex-col gap-3 pt-3">
          <ColorField
            label="Основен цвят"
            value={settings.primaryColor}
            onChange={(primaryColor) => onChange({ primaryColor })}
          />
          <ColorField
            label="Акцентен цвят"
            value={settings.accentColor}
            onChange={(accentColor) => onChange({ accentColor })}
          />
        </div>
      </details>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-900">Оформление на header-а</p>
        <div className="grid grid-cols-3 gap-2">
          {HEADER_VARIANTS.map((variant) => {
            const meta = HEADER_VARIANT_META[variant];
            const active = settings.headerVariant === variant;
            return (
              <button
                key={variant}
                type="button"
                aria-pressed={active}
                title={meta.hint}
                onClick={() => onChange({ headerVariant: variant })}
                className={`flex flex-col items-center gap-1.5 rounded-control border-2 p-2 text-center transition-colors ${
                  active ? "border-brand-600" : "border-surface-200 hover:border-surface-300"
                }`}
              >
                <span className="flex h-8 w-full items-center justify-center rounded bg-surface-100 text-ink-700">
                  {meta.sketch}
                </span>
                <span className="text-xs font-medium text-ink-900">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-900">Оформление на footer-а</p>
        <div className="grid grid-cols-2 gap-2">
          {([1, 2] as const).map((variant) => {
            const active = settings.footerVariant === variant;
            const label = variant === 1 ? "Богат (колони)" : "Минимален (центриран)";
            return (
              <button
                key={variant}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ footerVariant: variant })}
                className={`flex flex-col items-center gap-1.5 rounded-control border-2 p-2 text-center transition-colors ${
                  active ? "border-brand-600" : "border-surface-200 hover:border-surface-300"
                }`}
              >
                <span className="flex h-8 w-full items-center justify-center rounded bg-surface-100 text-ink-700">
                  {variant === 1 ? (
                    <span className="flex w-full items-start justify-between px-1.5">
                      <span className="flex flex-col gap-0.5">
                        <span className="h-1.5 w-5 rounded-full bg-current opacity-80" />
                        <span className="h-1 w-6 rounded-full bg-current opacity-30" />
                      </span>
                      <span className="flex gap-1">
                        <span className="flex flex-col gap-0.5">
                          <span className="h-1 w-3 rounded-full bg-current opacity-40" />
                          <span className="h-1 w-3 rounded-full bg-current opacity-40" />
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="h-1 w-3 rounded-full bg-current opacity-40" />
                          <span className="h-1 w-3 rounded-full bg-current opacity-40" />
                        </span>
                      </span>
                    </span>
                  ) : (
                    <span className="flex flex-col items-center gap-0.5">
                      <span className="h-1.5 w-5 rounded-full bg-current opacity-80" />
                      <span className="flex gap-0.5">
                        <span className="h-1 w-2 rounded-full bg-current opacity-40" />
                        <span className="h-1 w-2 rounded-full bg-current opacity-40" />
                        <span className="h-1 w-2 rounded-full bg-current opacity-40" />
                      </span>
                    </span>
                  )}
                </span>
                <span className="text-xs font-medium text-ink-900">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Рестарт на onboarding wizard-а: новата рецепта презаписва ЧЕРНОВАТА
          (публикуваният сайт не се пипа до изрично „Публикувай"). */}
      <div className="border-t border-surface-200 pt-4">
        <a
          href="/dashboard/website?wizard=1"
          onClick={(e) => {
            if (
              !window.confirm(
                "Wizard-ът ще замени незапазените промени и черновата с нова рецепта. Публикуваният сайт не се променя. Продължаваш ли?",
              )
            ) {
              e.preventDefault();
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-brand-600"
        >
          <Icon name="sparkles" size={15} />
          Започни отначало с wizard-а
        </a>
      </div>
    </div>
  );
}
