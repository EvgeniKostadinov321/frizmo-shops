import { Skeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-11 w-full sm:max-w-xs" />
      <div className="flex flex-col gap-px overflow-hidden rounded-card border border-surface-200">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 bg-surface-0 p-4">
            <Skeleton className="h-4 w-12 shrink-0" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
