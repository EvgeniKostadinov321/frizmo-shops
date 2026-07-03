import Link from "next/link";
import { Icon } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
        <Icon name="search" size={26} />
      </span>
      <h1 className="text-2xl font-bold text-ink-900">Страницата не е намерена</h1>
      <p className="max-w-md text-ink-700">
        Този адрес не съществува, или магазинът все още не е публикуван.
      </p>
      <Link href="/" className="text-brand-600 underline hover:text-brand-700">
        Към Frizmo Shops
      </Link>
    </main>
  );
}
