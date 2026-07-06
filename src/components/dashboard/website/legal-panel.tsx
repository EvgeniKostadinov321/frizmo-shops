"use client";

import { Button, Card, Textarea } from "@/components/ui";
import { LEGAL_SECTION_IDS, LEGAL_SECTION_TITLES } from "@/lib/legal-template";

interface LegalPanelProps {
  overrides: Record<string, string>;
  onChange: (overrides: Record<string, string>) => void;
}

/** Кратко описание за всяка секция — какво покрива по подразбиране. */
const HINTS: Record<string, string> = {
  general: "Кой е търговецът и че поръчката означава приемане на условията.",
  payment: "Как се потвърждава поръчката и приеманите методи на плащане.",
  delivery: "Срокове и условия за доставка.",
  returns: "Право на отказ в 14 дни (ЗЗП) и как се връща стока.",
  privacy: "Как се обработват личните данни (GDPR).",
};

/**
 * Редактор на правните текстове: по едно поле на секция. Празно = стандартният
 * шаблонен текст (виж се на живо в /terms). Търговецът презаписва само каквото
 * иска — юридическа отговорност за съдържанието е негова.
 */
export function LegalPanel({ overrides, onChange }: LegalPanelProps) {
  function setSection(id: string, value: string) {
    const next = { ...overrides };
    if (value.trim()) next[id] = value;
    else delete next[id];
    onChange(next);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-bold text-ink-900">Правна информация</h2>
        <p className="mt-1 text-sm text-ink-500">
          Показва се на страница „Условия“. Празно поле = стандартният ни текст.
          Попълни само това, което искаш да смениш. Празен ред = нов параграф.
        </p>
      </div>

      {LEGAL_SECTION_IDS.map((id) => (
        <div key={id} className="flex flex-col gap-1.5">
          <Textarea
            label={LEGAL_SECTION_TITLES[id]}
            rows={4}
            value={overrides[id] ?? ""}
            placeholder="Празно = стандартният текст"
            hint={HINTS[id]}
            onChange={(e) => setSection(id, e.target.value)}
          />
          {overrides[id] && (
            <div>
              <Button variant="ghost" size="sm" onClick={() => setSection(id, "")}>
                Върни стандартния текст
              </Button>
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
