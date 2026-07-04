"use client";

import { useEffect, useState } from "react";
import { Button, Checkbox, Icon, Modal } from "@/components/ui";

const INTRO_KEY = "frizmo-website-intro";
const SUPPORT_EMAIL = "supportfrizmo@gmail.com";

/**
 * Показва се при всяко влизане в редактора, докато потребителят не чекне
 * „Не показвай това повече" (localStorage, като cookie банера). Обяснява, че
 * билдърът е за десктоп и че екипът може да настрои сайта вместо него.
 */
export function WebsiteIntroModal() {
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && !window.localStorage.getItem(INTRO_KEY)) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    if (dontShow) window.localStorage.setItem(INTRO_KEY, "1");
    setOpen(false);
  }

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title="Добре дошъл в редактора на твоя сайт"
      footer={<Button onClick={dismiss}>Разбрах, да започваме</Button>}
    >
      <div className="flex flex-col gap-5">
        <div className="flex gap-3">
          <Icon name="monitor" size={22} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="font-semibold text-ink-900">
              Редакторът работи най-добре от компютър или лаптоп
            </p>
            <p className="mt-1 text-sm text-ink-600">
              За удобна и прецизна настройка препоръчваме голям екран. Редакторът
              работи и от телефон, но заради малкото пространство прегледът няма да
              изглежда 1:1 с истинския ти сайт.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Icon name="sparkles" size={22} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="font-semibold text-ink-900">Искаш готов сайт без усилия?</p>
            <p className="mt-1 text-sm text-ink-600">
              Свържи се с нас на{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-brand-600 underline"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              и ще настроим целия ти сайт вместо теб — тема, секции, снимки и текстове.
            </p>
          </div>
        </div>

        <Checkbox
          label="Не показвай това повече"
          checked={dontShow}
          onChange={(e) => setDontShow(e.target.checked)}
        />
      </div>
    </Modal>
  );
}
