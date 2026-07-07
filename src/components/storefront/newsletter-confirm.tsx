"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { confirmNewsletter, type ConfirmResult } from "@/actions/newsletter";

const MESSAGES: Record<ConfirmResult, { title: string; text: string }> = {
  confirmed: {
    title: "Абонаментът е потвърден!",
    text: "Благодарим — вече ще получаваш новини и оферти.",
  },
  already: {
    title: "Вече си абониран",
    text: "Този имейл вече е потвърден. Няма нужда да правиш нищо.",
  },
  unsubscribed: {
    title: "Отписа се успешно",
    text: "Няма да получаваш повече имейли. Можеш да се абонираш пак по всяко време.",
  },
  invalid: {
    title: "Линкът е невалиден",
    text: "Линкът е грешен или изтекъл. Опитай да се абонираш отново от сайта.",
  },
};

const PROMPT: Record<"confirm" | "unsubscribe", { title: string; text: string; cta: string }> = {
  confirm: {
    title: "Потвърди абонамента",
    text: "Натисни бутона, за да завършиш абонамента си и да получаваш новини и оферти.",
    cta: "Потвърди абонамента",
  },
  unsubscribe: {
    title: "Отписване",
    text: "Натисни бутона, за да спреш да получаваш имейли от този магазин.",
    cta: "Потвърди отписване",
  },
};

/**
 * Действието се задейства от БУТОН (не при рендиране на страницата) — иначе
 * prefetch/preview на линка от имейл клиент би потвърдил/отписал автоматично.
 */
export function NewsletterConfirm({
  shopSlug,
  shopHref,
  token,
  action,
}: {
  shopSlug: string;
  shopHref: string;
  token: string;
  action: "confirm" | "unsubscribe";
}) {
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      setResult(await confirmNewsletter({ shopSlug, token, action }));
    });
  }

  const view = result ? MESSAGES[result] : PROMPT[action];

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-(family-name:--sf-font-heading) text-3xl text-(--sf-text)">
        {view.title}
      </h1>
      <p className="text-(--sf-muted)">{view.text}</p>

      {result === null ? (
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="mt-2 inline-flex h-11 items-center rounded-(--sf-radius) bg-(--sf-primary) px-6 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Момент…" : PROMPT[action].cta}
        </button>
      ) : (
        <Link
          href={shopHref}
          className="mt-2 inline-flex h-11 items-center rounded-(--sf-radius) bg-(--sf-primary) px-6 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90"
        >
          Към магазина
        </Link>
      )}
    </div>
  );
}
