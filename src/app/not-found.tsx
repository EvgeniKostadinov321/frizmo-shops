import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <Image
        src="/bee-lost.png"
        alt=""
        aria-hidden
        width={160}
        height={160}
        className="h-36 w-auto object-contain sm:h-40"
      />
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
        Страницата не е намерена
      </h1>
      <p className="max-w-md text-ink-700">
        Търсихме навсякъде — този адрес не съществува, или магазинът все още не е публикуван.
      </p>
      <Link href="/" className="text-brand-600 underline hover:text-brand-700">
        Към Frizmo Shops
      </Link>
    </main>
  );
}
