"use client";

import { useEffect } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";

export default function LeadsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer maxWidth="max-w-5xl">
      <h1 className="mb-6 text-xl font-semibold">Leads</h1>
      <ErrorState
        message="Something went wrong while loading leads."
        variant="page"
        action={
          <Button type="button" variant="secondary" onClick={retry}>
            Try again
          </Button>
        }
      />
    </PageContainer>
  );
}
