"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { sendCampaign } from "@/actions/newsletter";
import { Button, ConfirmDialog, Input, Textarea } from "@/components/ui";

/** S4: „Нова кампания" — тема + текст до всички потвърдени абонати. */
export function CampaignComposer({ recipientCount }: { recipientCount: number }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSend() {
    setConfirming(false);
    setBusy(true);
    setFieldErrors({});
    try {
      const result = await sendCampaign({ subject, body });
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(`Изпратено до ${result.data.sent} от ${result.data.total} абонати.`);
      setSubject("");
      setBody("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-surface-200 bg-surface-0 p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-ink-900">Нова кампания</h2>
        <p className="mt-1 text-sm text-ink-500">
          Ще се изпрати до {recipientCount === 1 ? "1 потвърден абонат" : `${recipientCount} потвърдени абонати`}.
          Всеки имейл включва линк за отписване.
        </p>
      </div>

      <Input
        label="Тема"
        required
        maxLength={120}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        error={fieldErrors.subject}
        placeholder="Напр. Нови продукти този месец"
      />
      <Textarea
        label="Съдържание"
        required
        rows={6}
        maxLength={5000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        error={fieldErrors.body}
        hint="Обикновен текст — празен ред разделя параграфите."
      />

      <div>
        <Button
          loading={busy}
          disabled={recipientCount === 0 || subject.trim().length < 3 || body.trim().length < 10}
          onClick={() => setConfirming(true)}
        >
          Изпрати кампанията
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleSend}
        message={`Изпращане на „${subject.trim()}“ до ${recipientCount} ${recipientCount === 1 ? "абонат" : "абонати"}? Действието не може да бъде спряно.`}
      />
    </section>
  );
}
