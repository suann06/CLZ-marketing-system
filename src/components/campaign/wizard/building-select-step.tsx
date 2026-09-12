"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type BuildingSummary = {
  id: string;
  name: string;
  address: string | null;
};

export type DatasetGroup = {
  datasetId: string;
  datasetName: string;
  buildings: BuildingSummary[];
};

export function BuildingSelectStep({
  campaignId,
  campaignName,
  datasetGroups,
  initialSelectedBuildingIds,
}: {
  campaignId: string;
  campaignName: string;
  datasetGroups: DatasetGroup[];
  initialSelectedBuildingIds: string[];
}) {
  const router = useRouter();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelectedBuildingIds),
  );
  const [search, setSearch] = useState("");
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

  // Search only filters what's displayed — it never touches building.name or
  // any other source value.
  const query = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!query) return datasetGroups;
    return datasetGroups
      .map((group) => ({
        ...group,
        buildings: group.buildings.filter((b) => b.name.toLowerCase().includes(query)),
      }))
      .filter((group) => group.buildings.length > 0);
  }, [datasetGroups, query]);

  async function handleContinue() {
    setFormError(null);

    const buildingIds = Array.from(selectedIds);
    if (buildingIds.length === 0) {
      setFormError("Select at least one building before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/buildings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildingIds }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(
          typeof body?.error === "string" ? body.error : "Could not save building selection. Please try again.",
        );
        return;
      }

      router.push(`/campaigns/${campaignId}/review`);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const totalBuildings = datasetGroups.reduce((sum, g) => sum + g.buildings.length, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold">{campaignName}</h1>
      <p className="mb-6 text-sm text-gray-500">Step 4 of 6 — Select Buildings</p>

      <div className="mb-6 rounded border border-gray-200 p-4">
        <p className="mb-2 text-sm font-medium">
          Selected datasets ({datasetGroups.length})
        </p>
        <ul className="flex flex-wrap gap-2">
          {datasetGroups.map((g) => (
            <li
              key={g.datasetId}
              className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white"
            >
              {g.datasetName} · {g.buildings.length}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by building name…"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
        />
        <p className="whitespace-nowrap text-sm text-gray-600">
          {selectedIds.size} of {totalBuildings} selected
        </p>
      </div>

      {filteredGroups.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
          No buildings match your search.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {filteredGroups.map((group) => (
            <div key={group.datasetId}>
              <p className="mb-2 text-sm font-medium text-gray-700">
                {group.datasetName} ({group.buildings.length})
              </p>
              <ul className="divide-y divide-gray-200 rounded border border-gray-200">
                {group.buildings.map((b) => {
                  const checked = selectedIds.has(b.id);
                  return (
                    <li key={b.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${
                          checked ? "bg-gray-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(b.id)}
                        />
                        <span className="flex-1">
                          <span className="font-medium">{b.name}</span>
                          {b.address && <span className="ml-2 text-gray-500">{b.address}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {formError && <p className="mt-4 text-sm text-red-600">{formError}</p>}

      <div className="mt-6 flex items-center gap-3">
        <Link
          href={`/campaigns/${campaignId}/datasets`}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Back
        </Link>
        <button
          type="button"
          onClick={handleContinue}
          disabled={submitting}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
