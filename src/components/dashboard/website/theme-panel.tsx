"use client";

import { useId } from "react";
import { Select } from "@/components/ui";
import { PALETTE_PRESETS, THEME_LABELS, THEME_META, THEME_PRESETS } from "@/lib/themes";
import { THEMES, type SiteSettings, type ThemeId } from "@/schemas/site-settings";

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

      <div>
        <p className="mb-2 text-sm font-medium text-ink-900">Цветова комбинация</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PALETTE_PRESETS.map((palette) => {
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

      <Select
        label="Подредба на header-а"
        options={[
          { value: "logo-left", label: "Лого вляво" },
          { value: "logo-center", label: "Лого в центъра" },
        ]}
        value={settings.headerLayout}
        onChange={(e) =>
          onChange({ headerLayout: e.target.value as SiteSettings["headerLayout"] })
        }
      />
    </div>
  );
}
