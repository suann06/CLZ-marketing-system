"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

type ApplicationStatus = "not_started" | "in_progress" | "submitted";

export function LeadActionsPanel({
  leadId,
  status,
  applicationStatus: initialApplicationStatus,
  handoverAt,
  agentId,
  hasSale,
}: {
  leadId: string;
  status: "new" | "hot" | "warm" | "cold";
  applicationStatus: ApplicationStatus;
  handoverAt: string | null;
  agentId: string | null;
  hasSale: boolean;
}) {
  const router = useRouter();

  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus>(initialApplicationStatus);
  const [appError, setAppError] = useState<string | null>(null);
  const [appSuccess, setAppSuccess] = useState(false);
  const [appSubmitting, setAppSubmitting] = useState(false);

  const [confirmingHandover, setConfirmingHandover] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);

  const [saleStatus, setSaleStatus] = useState<"won" | "lost">("won");
  const [saleValue, setSaleValue] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [saleError, setSaleError] = useState<string | null>(null);
  const [saleSubmitting, setSaleSubmitting] = useState(false);

  async function handleApplicationStatusUpdate() {
    setAppError(null);
    setAppSuccess(false);
    setAppSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/application-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationStatus }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setAppError(typeof body?.error === "string" ? body.error : "Could not update application status.");
        return;
      }
      setAppSuccess(true);
      router.refresh();
    } catch {
      setAppError("Could not reach the server. Please try again.");
    } finally {
      setAppSubmitting(false);
    }
  }

  async function handleHandover() {
    setHandoverError(null);
    setHandoverSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setHandoverError(typeof body?.error === "string" ? body.error : "Could not hand over this lead.");
        return;
      }
      setConfirmingHandover(false);
      router.refresh();
    } catch {
      setHandoverError("Could not reach the server. Please try again.");
    } finally {
      setHandoverSubmitting(false);
    }
  }

  async function handleSaleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaleError(null);
    setSaleSubmitting(true);
    try {
      const payload =
        saleStatus === "won"
          ? { status: "won" as const, saleValue: Number(saleValue) }
          : { status: "lost" as const, lostReason };

      const res = await fetch(`/api/leads/${leadId}/sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setSaleError(typeof body?.error === "string" ? body.error : "Could not record this sale outcome.");
        return;
      }
      router.refresh();
    } catch {
      setSaleError("Could not reach the server. Please try again.");
    } finally {
      setSaleSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Application Status">
        <div className="flex items-center gap-2">
          <Select
            value={applicationStatus}
            onChange={(e) => setApplicationStatus(e.target.value as ApplicationStatus)}
            aria-label="Application status"
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="submitted">Submitted</option>
          </Select>
          <Button type="button" onClick={handleApplicationStatusUpdate} isLoading={appSubmitting}>
            {appSubmitting ? "Updating…" : "Update"}
          </Button>
          {appSuccess && !appError && <span className="text-sm text-success">Saved.</span>}
        </div>
        {appError && (
          <div className="mt-2">
            <ErrorState message={appError} />
          </div>
        )}
      </Card>

      <Card title="Human Handover">
        {handoverAt ? (
          <p className="text-sm text-muted">
            Handed over at {new Date(handoverAt).toLocaleString()} to agent {agentId}.
          </p>
        ) : status === "hot" ? (
          <>
            {!confirmingHandover ? (
              <Button type="button" onClick={() => setConfirmingHandover(true)}>
                Hand Over to Agent
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span>Confirm handover to yourself as the assigned agent?</span>
                <Button type="button" size="sm" onClick={handleHandover} isLoading={handoverSubmitting}>
                  {handoverSubmitting ? "Handing over…" : "Yes, hand over"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmingHandover(false)}
                  disabled={handoverSubmitting}
                >
                  Cancel
                </Button>
              </div>
            )}
            {handoverError && (
              <div className="mt-2">
                <ErrorState message={handoverError} />
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Only available once this Lead is classified &quot;hot&quot;.</p>
        )}
      </Card>

      <Card title="Sale Outcome">
        {hasSale ? (
          <p className="text-sm text-muted">A sale outcome has already been recorded for this Lead.</p>
        ) : applicationStatus !== "submitted" ? (
          <p className="text-sm text-muted">Only available once the application is &quot;submitted&quot;.</p>
        ) : (
          <form onSubmit={handleSaleSubmit} className="flex flex-col gap-3">
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="saleStatus"
                  checked={saleStatus === "won"}
                  onChange={() => setSaleStatus("won")}
                />
                Won
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="saleStatus"
                  checked={saleStatus === "lost"}
                  onChange={() => setSaleStatus("lost")}
                />
                Lost
              </label>
            </div>
            {saleStatus === "won" ? (
              <Input
                type="number"
                required
                min={0.01}
                step="0.01"
                placeholder="Sale value (RM)"
                value={saleValue}
                onChange={(e) => setSaleValue(e.target.value)}
              />
            ) : (
              <Input
                type="text"
                required
                placeholder="Reason for loss"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
              />
            )}
            {saleError && <ErrorState message={saleError} />}
            <div>
              <Button type="submit" isLoading={saleSubmitting}>
                {saleSubmitting ? "Recording…" : "Record Sale Outcome"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
