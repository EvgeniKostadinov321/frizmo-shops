"use client";

import { useEffect, useState } from "react";

interface Unit {
  label: string;
  value: number;
}

/** Разбива оставащите милисекунди на дни/часове/минути/секунди. */
function breakdown(ms: number): Unit[] {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [
    { label: "дни", value: days },
    { label: "ч", value: hours },
    { label: "мин", value: minutes },
    { label: "сек", value: seconds },
  ];
}

/**
 * Отброяване до дата (промоционална спешност) в promo-banner. При изтичане
 * ИЛИ невалидна дата не се рендерира нищо — банерът остава без таймер.
 * Целта се чете само на клиента (сървърният рендер няма достъп до „сега").
 */
export function PromoCountdown({ target, onImage }: { target: string; onImage: boolean }) {
  /* null = още не изчислено (SSR) или невалидна дата — и в двата случая не
     рисуваме нищо, така таймерът е чисто клиентски (без hydration разминаване
     по „сега"). */
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const deadline = new Date(target).getTime();
    if (Number.isNaN(deadline)) return;
    /* queueMicrotask: синхронен setState в effect чупи react-compiler lint. */
    const tick = () => setRemaining(deadline - Date.now());
    queueMicrotask(tick);
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining === null || remaining <= 0) return null;

  const units = breakdown(remaining);
  /* Водещите нулеви дни се крият (без „0 дни"), но час/мин/сек винаги. */
  const visible = units[0]!.value === 0 ? units.slice(1) : units;

  return (
    <div className={`flex items-center gap-3 ${onImage ? "text-white" : "text-(--sf-text)"}`}>
      {visible.map((u) => (
        <div key={u.label} className="flex flex-col items-center">
          <span className="font-(family-name:--sf-font-heading) text-3xl leading-none tabular-nums sm:text-4xl">
            {String(u.value).padStart(2, "0")}
          </span>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
}
