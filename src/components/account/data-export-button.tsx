"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui";

/**
 * GDPR чл.20 — бутон за сваляне на своите данни (JSON). Извиква подадения server
 * action, който връща JSON string, и го сваля като файл в браузъра.
 */
export function DataExportButton({
  action,
  filename,
}: {
  action: () => Promise<string>;
  filename: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const json = await action();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Данните ти са изтеглени.");
    } catch {
      toast.error("Изтеглянето не бе успешно. Опитай пак.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" loading={busy} onClick={download} className="self-start">
      Изтегли моите данни (JSON)
    </Button>
  );
}
