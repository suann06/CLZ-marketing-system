import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function PerformanceLoading() {
  return (
    <PageContainer maxWidth="max-w-5xl">
      <Skeleton className="mb-6 h-7 w-40" />
      <Skeleton className="mb-6 h-24 w-full" />
      <Skeleton className="mb-6 h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </PageContainer>
  );
}
