import { Skeleton } from "@/components/ui/skeleton";

export default function DatasetsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Skeleton className="mb-6 h-7 w-64" />
      <Skeleton className="mb-8 h-8 w-full max-w-md" />
      <Skeleton className="mb-6 h-24 w-full" />
      <Skeleton className="mb-3 h-9 w-full max-w-xs" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
