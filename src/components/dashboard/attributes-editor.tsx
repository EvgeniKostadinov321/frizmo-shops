"use client";

import { Button, Input } from "@/components/ui";

export interface AttributeRow {
  name: string;
  value: string;
}

interface AttributesEditorProps {
  attributes: AttributeRow[];
  onChange: (attributes: AttributeRow[]) => void;
}

export function AttributesEditor({ attributes, onChange }: AttributesEditorProps) {
  function update(index: number, patch: Partial<AttributeRow>) {
    onChange(attributes.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  return (
    <div className="flex flex-col gap-3">
      {attributes.length === 0 && (
        <p className="text-sm text-ink-500">
          Например: „Материя: 100% памук“, „Произход: Родопите“, „Тегло: 500г“.
        </p>
      )}
      {attributes.map((attr, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <Input
              label={`Характеристика ${i + 1} — име`}
              hideLabel
              placeholder="Име (напр. Материя)"
              value={attr.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <Input
              label={`Характеристика ${i + 1} — стойност`}
              hideLabel
              placeholder="Стойност (напр. 100% памук)"
              value={attr.value}
              onChange={(e) => update(i, { value: e.target.value })}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Премахни характеристиката"
            onClick={() => onChange(attributes.filter((_, idx) => idx !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
      {attributes.length < 20 && (
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onChange([...attributes, { name: "", value: "" }])}
          >
            + Добави характеристика
          </Button>
        </div>
      )}
    </div>
  );
}
