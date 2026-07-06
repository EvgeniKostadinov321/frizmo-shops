"use client";

import { useState } from "react";
import { toast } from "sonner";
import { exportSubscribersCsv } from "@/actions/subscribers";
import { Button, Icon } from "@/components/ui";

/** Бутон „Изтегли CSV" — генерира CSV на сървъра и го сваля в браузъра. */
export function SubscribersExport() {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const result = await exportSubscribersCsv();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.count === 0) {
        toast.error("Още няма потвърдени абонати.");
        return;
      }
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "abonati.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={download} loading={loading}>
      <Icon name="arrow-down" size={15} className="-ml-0.5" />
      Изтегли CSV
    </Button>
  );
}
