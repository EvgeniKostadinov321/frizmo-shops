import { Skeleton } from "@/components/ui/skeleton";

export default function OrderDetailLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-card border border-surface-200 bg-surface-0 p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-surface-200 bg-surface-0 p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </div>
  );
}
