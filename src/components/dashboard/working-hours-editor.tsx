"use client";

import { useState } from "react";
import { Checkbox, TimeSelect } from "@/components/ui";
import { DAY_LABELS, type WorkingDay } from "@/lib/working-hours";

interface WorkingHoursEditorProps {
  value: WorkingDay[];
  onChange: (days: WorkingDay[]) => void;
}

/** Еднакъв ли е графикът на всички делнични дни (Пон–Пет)? */
function weekdaysUniform(days: WorkingDay[]): boolean {
  const key = (d: WorkingDay) => (d.closed ? "closed" : `${d.open}-${d.close}`);
  return [1, 2, 3, 4].every((i) => key(days[i]!) === key(days[0]!));
}

/** Един ред за ден/група дни: часове + „Почивен". */
function DayRow({
  label,
  day,
  onChange,
}: {
  label: string;
  day: WorkingDay;
  onChange: (patch: Partial<WorkingDay>) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-control border border-surface-200 p-3">
      {/* Заглавие на реда + „Почивен" винаги един до друг — компактно и без
          хоризонтален скрол в тесни контейнери (drawer). Часовете са отдолу. */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink-900">{label}</span>
        <Checkbox
          label="Почивен"
          checked={day.closed}
          onChange={(e) => onChange({ closed: e.target.checked })}
        />
      </div>
      {!day.closed && (
        <div className="flex items-center gap-2">
          <TimeSelect
            label={`${label} — отваря`}
            value={day.open}
            onChange={(v) => onChange({ open: v })}
            className="flex-1"
          />
          <span className="shrink-0 text-ink-500">–</span>
          <TimeSelect
            label={`${label} — затваря`}
            value={day.close}
            onChange={(v) => onChange({ close: v })}
            className="flex-1"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Редактор на работно време. По подразбиране е опростен: един ред „Понеделник –
 * Петък" (общо за делниците) + отделни редове за събота и неделя. Toggle
 * „Различно време по дни" разкрива 7-те дни поотделно. Моделът винаги е масив
 * от 7 дни (сървърната схема го изисква) — опростеният режим просто прилага
 * промяната на делничния ред към всичките 5 делнични дни.
 */
export function WorkingHoursEditor({ value, onChange }: WorkingHoursEditorProps) {
  /* Стартираме в custom режим само ако делниците вече се различават (edit на
     магазин с разнороден график) — иначе опростено. */
  const [custom, setCustom] = useState(() => !weekdaysUniform(value));

  function update(index: number, patch: Partial<WorkingDay>) {
    onChange(value.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  /* Опростен режим: промяна на делничния ред → всичките 5 делнични дни. */
  function updateWeekdays(patch: Partial<WorkingDay>) {
    onChange(value.map((d, i) => (i <= 4 ? { ...d, ...patch } : d)));
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <div className="mb-1 flex items-center justify-between gap-3">
        <legend className="text-sm font-medium text-ink-900">Работно време</legend>
        <Checkbox
          label="Различно време по дни"
          checked={custom}
          onChange={(e) => setCustom(e.target.checked)}
        />
      </div>

      {custom ? (
        DAY_LABELS.map((label, i) => (
          <DayRow key={label} label={label} day={value[i]!} onChange={(p) => update(i, p)} />
        ))
      ) : (
        <>
          <DayRow label="Понеделник – Петък" day={value[0]!} onChange={updateWeekdays} />
          <DayRow label={DAY_LABELS[5]} day={value[5]!} onChange={(p) => update(5, p)} />
          <DayRow label={DAY_LABELS[6]} day={value[6]!} onChange={(p) => update(6, p)} />
        </>
      )}
    </fieldset>
  );
}
