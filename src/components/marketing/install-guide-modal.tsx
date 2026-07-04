"use client";

import { useEffect, useState } from "react";
import {
  type Browser,
  detectPlatform,
  getInstallInstructions,
  type OS,
} from "@/lib/pwa-platform";
import { Button, Icon, Modal } from "@/components/ui";

/* Ръчните избори за превключвателя „Друго устройство?". Браузърът се приема
   като най-честия за всяка платформа — точните стъпки не зависят силно от него
   при ръчен избор (iOS→safari е единственият път; android→chrome е мнозинството). */
const DEVICE_CHOICES: { os: OS; label: string }[] = [
  { os: "ios", label: "iPhone" },
  { os: "android", label: "Android" },
  { os: "desktop", label: "Компютър" },
];

export function InstallGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  /* Разпознатата платформа + ръчно избран override. null = още не е детектирано
     (сървър/първи render), за да няма hydration mismatch. */
  const [os, setOs] = useState<OS | null>(null);
  const [browser, setBrowser] = useState<Browser>("other");

  useEffect(() => {
    if (!open) return;
    const p = detectPlatform();
    /* setState синхронно в effect чупи react-compiler lint → queueMicrotask */
    queueMicrotask(() => {
      setOs(p.os);
      setBrowser(p.browser);
    });
  }, [open]);

  /* При ръчен избор ползваме дефолтен браузър за платформата. */
  function pickDevice(next: OS) {
    setOs(next);
    setBrowser(next === "ios" ? "safari" : "chrome");
  }

  const guide = os ? getInstallInstructions(os, browser) : null;

  return (
    <Modal open={open} onClose={onClose} title="Инсталирай Frizmo Shops">
      {guide && (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-ink-500">
            Изглежда използваш{" "}
            <span className="font-semibold text-ink-900">{guide.deviceLabel}</span>.
          </p>

          {guide.canInstall === "wrong-browser" ? (
            <p className="rounded-control border border-surface-200 bg-surface-50 p-4 text-sm text-ink-700">
              {guide.note}
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-sm font-extrabold text-brand-700">
                    {i + 1}
                  </span>
                  <span className="flex flex-1 items-center gap-2 pt-1 text-sm text-ink-900">
                    {step.icon && (
                      <Icon name={step.icon} size={16} className="shrink-0 text-ink-500" />
                    )}
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {guide.note && guide.canInstall !== "wrong-browser" && (
            <p className="text-xs text-ink-500">{guide.note}</p>
          )}

          {/* Ръчен превключвател — при грешна детекция */}
          <div className="border-t border-surface-200 pt-4">
            <p className="mb-2 text-xs font-medium text-ink-500">Друго устройство?</p>
            <div className="flex flex-wrap gap-2">
              {DEVICE_CHOICES.map((choice) => (
                <button
                  key={choice.os}
                  type="button"
                  onClick={() => pickDevice(choice.os)}
                  aria-pressed={os === choice.os}
                  className={`h-9 rounded-full border px-4 text-sm font-medium transition-colors ${
                    os === choice.os
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-surface-300 text-ink-700 hover:bg-surface-100"
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>

          <Button variant="secondary" onClick={onClose} className="w-full">
            Разбрах
          </Button>
        </div>
      )}
    </Modal>
  );
}
