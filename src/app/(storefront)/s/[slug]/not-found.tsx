import Image from "next/image";
import Link from "next/link";

export default function ShopNotFound() {
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
      <h1 className="text-2xl font-bold text-ink-900">Магазинът не е намерен</h1>
      <p className="max-w-md text-ink-700">
        Този магазин не съществува или все още не е публикуван.
      </p>
      <Link href="/" className="text-brand-600 underline hover:text-brand-700">
        Към Frizmo Shops
      </Link>
    </main>
  );
}
