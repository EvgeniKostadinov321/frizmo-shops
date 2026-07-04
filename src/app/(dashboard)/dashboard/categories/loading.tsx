import { Skeleton } from "@/components/ui/skeleton";

export default function CategoriesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-40" />
      </div>
      <div className="flex flex-col gap-px overflow-hidden rounded-card border border-surface-200">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 bg-surface-0 p-4">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
