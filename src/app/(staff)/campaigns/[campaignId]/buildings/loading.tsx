import { Skeleton } from "@/components/ui/skeleton";

export default function BuildingsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Skeleton className="mb-6 h-7 w-64" />
      <Skeleton className="mb-6 h-16 w-full" />
      <Skeleton className="mb-4 h-9 w-full max-w-xs" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
