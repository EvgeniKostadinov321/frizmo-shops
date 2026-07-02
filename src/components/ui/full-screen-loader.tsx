import { Spinner } from "./spinner";

/** Loader за цяла страница/екран — ползва се в loading.tsx файловете. */
export function FullScreenLoader({ label = "Зарежда се..." }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-ink-500"
    >
      <Spinner size="lg" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
