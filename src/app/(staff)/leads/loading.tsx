import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeadsLoading() {
  return (
    <PageContainer maxWidth="max-w-5xl">
      <Skeleton className="mb-6 h-7 w-32" />
      <Skeleton className="mb-4 h-9 w-full max-w-xs" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </PageContainer>
  );
}
