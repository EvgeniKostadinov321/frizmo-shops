"use client";

import { useState } from "react";
import { Button, Icon, Input } from "@/components/ui";
import type { OptionAxis } from "@/lib/variants";

interface OptionsEditorProps {
  axes: OptionAxis[];
  onChange: (axes: OptionAxis[]) => void;
}

function ValuesInput({
  axis,
  onAdd,
  onRemove,
}: {
  axis: OptionAxis;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim();
    if (value && !axis.values.includes(value)) onAdd(value);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {axis.values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1 text-xs font-medium text-brand-700"
          >
            {value}
            <button
              type="button"
              aria-label={`Премахни ${value}`}
              onClick={() => onRemove(value)}
              className="flex size-5 items-center justify-center rounded-full text-brand-600 transition-colors hover:bg-brand-100 hover:text-brand-700"
            >
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}
      </div>
      <Input
        label={`Стойности за ${axis.name || "опцията"}`}
        hideLabel
        placeholder="Напиши стойност и натисни Enter (напр. M)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

export function OptionsEditor({ axes, onChange }: OptionsEditorProps) {
  function update(index: number, patch: Partial<OptionAxis>) {
    onChange(axes.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  return (
    <div className="flex flex-col gap-4">
      {axes.length === 0 && (
        <p className="text-sm text-ink-500">
          Опциите създават варианти на продукта — например „Размер“ (S, M, L) и „Цвят“
          (син, червен). Всяка комбинация може да има собствена цена, наличност и снимки.
        </p>
      )}
      {axes.map((axis, i) => (
        <div key={i} className="rounded-control border border-surface-200 p-4">
          <div className="mb-3 flex items-start gap-2">
            <div className="flex-1">
              <Input
                label={`Опция ${i + 1} — име`}
                hideLabel
                placeholder="Име на опцията (напр. Размер)"
                value={axis.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Премахни опцията"
              onClick={() => onChange(axes.filter((_, idx) => idx !== i))}
            >
              <Icon name="x" size={18} />
            </Button>
          </div>
          <ValuesInput
            axis={axis}
            onAdd={(value) => update(i, { values: [...axis.values, value] })}
            onRemove={(value) => update(i, { values: axis.values.filter((v) => v !== value) })}
          />
        </div>
      ))}
      {axes.length < 3 && (
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onChange([...axes, { name: "", values: [] }])}
          >
            + Добави опция
          </Button>
        </div>
      )}
    </div>
  );
}
