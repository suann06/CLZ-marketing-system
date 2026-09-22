"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/campaign/wizard/wizard-shell";
import type { WizardStepKey } from "@/components/campaign/wizard/wizard-steps";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

export type DatasetSummary = {
  id: string;
  name: string;
  sourceFilename: string;
  rowCount: number;
  importedAt: string;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(new Date(iso));
}

export function DatasetSelectStep({
  campaignId,
  campaignName,
  initialDatasets,
  initialSelectedIds,
  completedSteps,
}: {
  campaignId: string;
  campaignName: string;
  initialDatasets: DatasetSummary[];
  initialSelectedIds: string[];
  completedSteps: WizardStepKey[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [datasets, setDatasets] = useState<DatasetSummary[]>(initialDatasets);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
  const [search, setSearch] = useState("");

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Choose a CSV or Excel file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await fetch("/api/datasets", { method: "POST", body: formData });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setUploadError(
          typeof body?.error === "string" ? body.error : "Could not import this file. Please try again.",
        );
        return;
      }

      const { dataset } = (await res.json()) as { dataset: DatasetSummary };
      setDatasets((prev) => [dataset, ...prev]);
      setSelectedIds((prev) => new Set(prev).add(dataset.id));
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setUploadError("Could not reach the server. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleContinue() {
    setFormError(null);

    const datasetIds = Array.from(selectedIds);
    if (datasetIds.length === 0) {
      setFormError("Select at least one dataset before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/datasets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetIds }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(
          typeof body?.error === "string" ? body.error : "Could not save dataset selection. Please try again.",
        );
        return;
      }

      router.push(`/campaigns/${campaignId}/buildings`);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedDatasets = datasets.filter((d) => selectedIds.has(d.id));

  // Client-side filter only, over the already-loaded list — no new query.
  const query = search.trim().toLowerCase();
  const filteredDatasets = useMemo(() => {
    if (!query) return datasets;
    return datasets.filter(
      (d) => d.name.toLowerCase().includes(query) || d.sourceFilename.toLowerCase().includes(query),
    );
  }, [datasets, query]);

  return (
    <WizardShell campaignId={campaignId} title={campaignName} currentStep="dataset" completedSteps={completedSteps}>
      <p className="mb-6 text-sm text-muted">
        Select one or more existing building datasets to target, or upload a new one. Each
        dataset is treated independently — datasets are never merged or deduplicated against
        each other.
      </p>

      <Card title={`Selected datasets (${selectedDatasets.length})`} className="mb-6">
        {selectedDatasets.length === 0 ? (
          <p className="text-sm text-muted">None selected yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {selectedDatasets.map((d) => (
              <li key={d.id}>
                <Badge>{d.name}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <form onSubmit={handleUpload} className="mb-8">
        <Card title="Upload a new dataset">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xlsm,.xls"
              className="flex-1 text-sm"
            />
            <Button type="submit" variant="secondary" isLoading={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
          {uploadError && <p className="mt-2 text-sm text-error">{uploadError}</p>}
        </Card>
      </form>

      <div className="mb-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">Existing datasets ({datasets.length})</p>
          {datasets.length > 0 && (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or filename…"
              aria-label="Search datasets"
              className="sm:max-w-xs"
            />
          )}
        </div>

        {datasets.length === 0 ? (
          <EmptyState title="No datasets yet" description="Upload one above to get started." />
        ) : filteredDatasets.length === 0 ? (
          <EmptyState title="No datasets match your search" description="Try a different name or filename." />
        ) : (
          <ul className="divide-y divide-border rounded border border-border">
            {filteredDatasets.map((d) => {
              const checked = selectedIds.has(d.id);
              return (
                <li key={d.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-sm ${
                      checked ? "bg-accent-subtle" : ""
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleSelected(d.id)} />
                    <span className="flex-1">
                      <span className="font-medium">{d.name}</span>
                      <span className="ml-2 text-muted">
                        {d.sourceFilename} · {d.rowCount} buildings · {formatDate(d.importedAt)}
                      </span>
                    </span>
                    {checked && <Badge status="approved">Selected</Badge>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {formError && <ErrorState message={formError} />}

      <div className="mt-6 flex items-center gap-3">
        <Link href={`/campaigns/${campaignId}/differentiators`}>
          <Button type="button" variant="secondary">
            Back
          </Button>
        </Link>
        <Button type="button" onClick={handleContinue} isLoading={submitting}>
          {submitting ? "Saving…" : "Continue"}
        </Button>
      </div>
    </WizardShell>
  );
}
