"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { importProductsCsv, type CsvImportResult } from "@/actions/products";
import { Button, Drawer, Icon } from "@/components/ui";

const MAX_FILE_BYTES = 1_000_000;

/** S8: „Експорт CSV" (route handler) + „Импорт CSV" (drawer с файл + резултат).
 *  `stacked` подрежда двата бутона вертикално и на цяла ширина (за мобилния
 *  filter drawer); по подразбиране са в ред (десктоп toolbar). */
export function ProductImportExport({ stacked = false }: { stacked?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setResult(null);
    if (!file) {
      setFileName("");
      setCsvText("");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Файлът е над 1MB.");
      e.target.value = "";
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Файлът не можа да бъде прочетен.");
    reader.readAsText(file, "utf-8");
  }

  async function handleImport() {
    if (!csvText) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await importProductsCsv({ csv: csvText });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.data);
      /* Числото ПРЕДИ думата → без съгласуване на причастие (1/много еднакво). */
      toast.success(`Импорт готов: нови ${res.data.created}, обновени ${res.data.updated}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    setFileName("");
    setCsvText("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <div className={stacked ? "flex flex-col gap-2" : "flex gap-2"}>
        <a
          href="/dashboard/products/export"
          download
          className={`inline-flex h-11 items-center gap-1.5 rounded-control border border-surface-300 bg-surface-0 px-4 text-sm font-medium text-ink-900 transition-colors hover:border-brand-500 ${
            stacked ? "justify-center" : ""
          }`}
        >
          <Icon name="download" size={16} />
          Експорт CSV
        </a>
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          className={stacked ? "w-full" : ""}
        >
          Импорт CSV
        </Button>
      </div>

      <Drawer
        open={open}
        onClose={close}
        title="Импорт на продукти от CSV"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Затвори
            </Button>
            <Button onClick={handleImport} loading={busy} disabled={!csvText}>
              Импортни
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-700">
            Форматът е този на експорта: колони <code>name</code> и <code>price</code> са
            задължителни; <code>slug</code>, <code>description</code>, <code>promo_price</code>,{" "}
            <code>stock</code>, <code>category</code>, <code>status</code> са по избор.
            Съществуващ slug → обновяване, нов → създаване. До 500 реда. Снимките не участват.
          </p>

          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed border-surface-300 bg-surface-50 p-4 text-center transition-colors hover:border-brand-500">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
              className="sr-only"
            />
            <Icon name="download" size={20} className="rotate-180 text-ink-500" />
            <span className="text-sm font-medium text-ink-900">
              {fileName || "Избери CSV файл"}
            </span>
            <span className="text-xs text-ink-500">до 1MB · UTF-8</span>
          </label>

          {result && (
            <div className="rounded-card border border-surface-200 bg-surface-0 p-4 text-sm">
              {/* Число ПРЕДИ думата → без съгласуване (нови 1 / нови 5 еднакво). */}
              <p className="font-medium text-ink-900">
                Нови: {result.created} · Обновени: {result.updated} · Пропуснати:{" "}
                {result.skipped.length}
              </p>
              {result.skipped.length > 0 && (
                <ul className="mt-2 max-h-48 list-inside list-disc overflow-y-auto text-danger-600">
                  {result.skipped.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
}
