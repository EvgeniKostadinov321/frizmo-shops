"use client";

import { Checkbox, Input } from "@/components/ui";
import { DAY_LABELS, type WorkingDay } from "@/lib/working-hours";

interface WorkingHoursEditorProps {
  value: WorkingDay[];
  onChange: (days: WorkingDay[]) => void;
}

export function WorkingHoursEditor({ value, onChange }: WorkingHoursEditorProps) {
  function update(index: number, patch: Partial<WorkingDay>) {
    onChange(value.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-ink-900">Работно време</legend>
      {value.map((day, i) => (
        <div
          key={DAY_LABELS[i]}
          className="flex flex-col gap-2 rounded-control border border-surface-200 p-3 sm:flex-row sm:items-center"
        >
          <span className="w-28 shrink-0 text-sm font-medium text-ink-900">
            {DAY_LABELS[i]}
          </span>
          <div className="flex flex-1 items-center gap-3">
            {day.closed ? (
              <span className="flex-1 text-sm text-ink-500">Почивен ден</span>
            ) : (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  label={`${DAY_LABELS[i]} — отваря`}
                  hideLabel
                  type="time"
                  value={day.open}
                  onChange={(e) => update(i, { open: e.target.value })}
                  className="max-w-32"
                />
                <span className="text-ink-500">–</span>
                <Input
                  label={`${DAY_LABELS[i]} — затваря`}
                  hideLabel
                  type="time"
                  value={day.close}
                  onChange={(e) => update(i, { close: e.target.value })}
                  className="max-w-32"
                />
              </div>
            )}
            <Checkbox
              label="Почивен"
              checked={day.closed}
              onChange={(e) => update(i, { closed: e.target.checked })}
            />
          </div>
        </div>
      ))}
    </fieldset>
  );
}
