import { Skeleton } from "@/components/ui/skeleton";

export default function FulfillmentLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: 2 }).map((_, card) => (
        <div key={card} className="flex flex-col gap-3 rounded-card border border-surface-200 bg-surface-0 p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-24" />
          </div>
          {Array.from({ length: 2 }).map((_, row) => (
            <div key={row} className="flex items-center justify-between rounded-control border border-surface-200 p-3">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
