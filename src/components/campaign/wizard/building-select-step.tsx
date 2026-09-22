"use client";

import { useMemo, useState } from "react";
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
  completedSteps,
}: {
  campaignId: string;
  campaignName: string;
  datasetGroups: DatasetGroup[];
  initialSelectedBuildingIds: string[];
  completedSteps: WizardStepKey[];
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

  // Scoped to whatever is currently visible (respects the active search),
  // so "select all" never silently selects buildings the user has filtered
  // out of view. Purely client-side Set manipulation — the same selectedIds
  // state toggleSelected() already uses; no new persistence/selection logic.
  const visibleIds = useMemo(
    () => filteredGroups.flatMap((g) => g.buildings.map((b) => b.id)),
    [filteredGroups],
  );
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  function selectAllVisible() {
    setSelectedIds((prev) => new Set([...prev, ...visibleIds]));
  }

  function deselectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) next.delete(id);
      return next;
    });
  }

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
    <WizardShell campaignId={campaignId} title={campaignName} currentStep="buildings" completedSteps={completedSteps}>
      <Card title={`Selected datasets (${datasetGroups.length})`} className="mb-6">
        <ul className="flex flex-wrap gap-2">
          {datasetGroups.map((g) => (
            <li key={g.datasetId}>
              <Badge>{g.datasetName} · {g.buildings.length}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      {totalBuildings === 0 ? (
        <EmptyState
          title="No buildings in the selected dataset(s)"
          description="Go back and choose a dataset that has buildings."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by building name…"
              aria-label="Search buildings"
              className="flex-1 sm:max-w-xs"
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
                disabled={visibleIds.length === 0}
              >
                {allVisibleSelected ? "Deselect all" : "Select all"}
              </Button>
              <p className="whitespace-nowrap text-sm text-muted">
                {selectedIds.size} of {totalBuildings} selected
              </p>
            </div>
          </div>

          {filteredGroups.length === 0 ? (
            <EmptyState title="No buildings match your search" description="Try a different building name." />
          ) : (
            <div className="flex flex-col gap-6">
              {filteredGroups.map((group) => (
                <div key={group.datasetId}>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    {group.datasetName} ({group.buildings.length})
                  </p>
                  <ul className="divide-y divide-border rounded border border-border">
                    {group.buildings.map((b) => {
                      const checked = selectedIds.has(b.id);
                      return (
                        <li key={b.id}>
                          <label
                            className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${
                              checked ? "bg-accent-subtle" : ""
                            }`}
                          >
                            <input type="checkbox" checked={checked} onChange={() => toggleSelected(b.id)} />
                            <span className="flex-1">
                              <span className="font-medium">{b.name}</span>
                              {b.address && <span className="ml-2 text-muted">{b.address}</span>}
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
        </>
      )}

      {formError && (
        <div className="mt-4">
          <ErrorState message={formError} />
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Link href={`/campaigns/${campaignId}/datasets`}>
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
