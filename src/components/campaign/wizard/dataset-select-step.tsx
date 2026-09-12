"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
}: {
  campaignId: string;
  campaignName: string;
  initialDatasets: DatasetSummary[];
  initialSelectedIds: string[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [datasets, setDatasets] = useState<DatasetSummary[]>(initialDatasets);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold">{campaignName}</h1>
      <p className="mb-6 text-sm text-gray-500">Step 3 of 6 — Select Dataset(s)</p>
      <p className="mb-6 text-sm text-gray-600">
        Select one or more existing building datasets to target, or upload a new one. Each
        dataset is treated independently — datasets are never merged or deduplicated against
        each other.
      </p>

      <div className="mb-6 rounded border border-gray-200 p-4">
        <p className="mb-2 text-sm font-medium">
          Selected datasets ({selectedDatasets.length})
        </p>
        {selectedDatasets.length === 0 ? (
          <p className="text-sm text-gray-500">None selected yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {selectedDatasets.map((d) => (
              <li
                key={d.id}
                className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white"
              >
                {d.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleUpload} className="mb-8 flex flex-col gap-2 rounded border border-gray-200 p-4">
        <p className="text-sm font-medium">Upload a new dataset</p>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xlsm,.xls"
            className="flex-1 text-sm"
          />
          <button
            type="submit"
            disabled={uploading}
            className="rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
        {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
      </form>

      <div className="mb-6">
        <p className="mb-2 text-sm font-medium">Existing datasets</p>
        {datasets.length === 0 ? (
          <p className="rounded border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
            No datasets yet. Upload one above.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded border border-gray-200">
            {datasets.map((d) => {
              const checked = selectedIds.has(d.id);
              return (
                <li key={d.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-sm ${
                      checked ? "bg-gray-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(d.id)}
                    />
                    <span className="flex-1">
                      <span className="font-medium">{d.name}</span>
                      <span className="ml-2 text-gray-500">
                        {d.sourceFilename} · {d.rowCount} buildings · {formatDate(d.importedAt)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {formError && <p className="mb-4 text-sm text-red-600">{formError}</p>}

      <button
        type="button"
        onClick={handleContinue}
        disabled={submitting}
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}
