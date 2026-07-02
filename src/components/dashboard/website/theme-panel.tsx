"use client";

import { useId } from "react";
import { Select } from "@/components/ui";
import { THEME_LABELS, THEME_PRESETS } from "@/lib/themes";
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
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {THEMES.map((theme: ThemeId) => {
          const preset = THEME_PRESETS[theme];
          const active = settings.theme === theme;
          return (
            <button
              key={theme}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ theme })}
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
        })}
      </div>

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
