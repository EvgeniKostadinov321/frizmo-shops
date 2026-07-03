import Image from "next/image";
import { Icon } from "@/components/ui";
import { formatPrice } from "@/lib/money";

type MiniProductCardProps = {
  name: string;
  priceCents: number;
  image: string | null;
  /** Първата снимка е LCP кандидат — preload-ва се. */
  priority?: boolean;
};

export function MiniProductCard({ name, priceCents, image, priority = false }: MiniProductCardProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-control border border-surface-200 bg-surface-0 p-2.5 shadow-card">
      {image ? (
        <Image
          src={image}
          alt=""
          width={40}
          height={40}
          priority={priority}
          className="size-10 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon name="store" size={16} />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-900">{name}</span>
      <span className="shrink-0 text-xs font-bold text-ink-900">{formatPrice(priceCents)}</span>
    </div>
  );
}
