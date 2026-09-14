"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  marketingStrategyOutputSchema,
  type MarketingStrategyOutput,
} from "@/server/ai/schemas/marketing-strategy-output";
import { GenerateContentButton } from "@/components/campaign/content/generate-content-button";

type Platform = "facebook" | "instagram" | "tiktok" | "whatsapp";
const PLATFORMS: Platform[] = ["facebook", "instagram", "tiktok", "whatsapp"];

function ListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      {items.map((value, index) => (
        <div key={index} className="flex gap-2">
          <input
            value={value}
            onChange={(e) => {
              const next = [...items];
              next[index] = e.target.value;
              onChange(next);
            }}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            aria-label={`Remove ${label} item`}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="self-start rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50"
      >
        + Add
      </button>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  approved: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-400",
};

export function StrategyReviewPanel({
  campaignId,
  strategyId: initialStrategyId,
  content: initialContent,
  version: initialVersion,
  status: initialStatus,
  existingContent,
}: {
  campaignId: string;
  strategyId: string;
  content: MarketingStrategyOutput;
  version: number;
  status: string;
  existingContent?: { version: number; status: string } | null;
}) {
  const router = useRouter();

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [strategyId, setStrategyId] = useState(initialStrategyId);
  const [content, setContent] = useState(initialContent);
  const [version, setVersion] = useState(initialVersion);
  const [status, setStatus] = useState(initialStatus);
  const [draft, setDraft] = useState(initialContent);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingApprove, setConfirmingApprove] = useState(false);

  function startEdit() {
    setDraft(content);
    setFormError(null);
    setMode("edit");
  }

  function cancelEdit() {
    setMode("view");
    setFormError(null);
  }

  async function handleSave() {
    setFormError(null);

    const parsed = marketingStrategyOutputSchema.safeParse(draft);
    if (!parsed.success) {
      setFormError("Please fill in all required fields before saving.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/strategy/${strategyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(
          typeof body?.error === "string" ? body.error : "Could not save changes. Please try again.",
        );
        return;
      }

      const { strategy } = (await res.json()) as {
        strategy: { id: string; version: number; status: string; content: MarketingStrategyOutput };
      };
      setStrategyId(strategy.id);
      setContent(strategy.content);
      setVersion(strategy.version);
      setStatus(strategy.status);
      setMode("view");
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove() {
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/strategy/${strategyId}/approve`, {
        method: "POST",
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(
          typeof body?.error === "string" ? body.error : "Could not approve this strategy. Please try again.",
        );
        return;
      }

      const { strategy } = (await res.json()) as { strategy: { status: string } };
      setStatus(strategy.status);
      setConfirmingApprove(false);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold">Marketing Strategy</h1>
      <p className="mb-6 text-sm text-gray-500">
        Version {version} ·{" "}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] ?? ""}`}
        >
          {status}
        </span>
      </p>

      {mode === "view" ? (
        <>
          <div className="flex flex-col gap-6">
            <section className="rounded border border-gray-200 p-4">
              <p className="mb-2 text-sm font-medium">Target Audience</p>
              <p className="mb-2 text-sm">{content.targetAudience.description}</p>
              <ul className="list-inside list-disc text-sm text-gray-600">
                {content.targetAudience.segments.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>

            <section className="rounded border border-gray-200 p-4">
              <p className="mb-2 text-sm font-medium">Customer Needs</p>
              <ul className="list-inside list-disc text-sm text-gray-600">
                {content.customerNeeds.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </section>

            <section className="rounded border border-gray-200 p-4">
              <p className="mb-2 text-sm font-medium">Positioning</p>
              <p className="text-sm text-gray-600">{content.positioning}</p>
            </section>

            <section className="rounded border border-gray-200 p-4">
              <p className="mb-2 text-sm font-medium">Marketing Angles</p>
              <ul className="list-inside list-disc text-sm text-gray-600">
                {content.marketingAngles.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </section>

            <section className="rounded border border-gray-200 p-4">
              <p className="mb-2 text-sm font-medium">Messaging Pillars</p>
              <div className="flex flex-col gap-3">
                {content.messagingPillars.map((p, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-gray-700">{p.title}</p>
                    <p className="text-sm text-gray-600">{p.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded border border-gray-200 p-4">
              <p className="mb-2 text-sm font-medium">Platform Direction</p>
              <div className="flex flex-col gap-3">
                {content.platformDirection.map((p, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium capitalize text-gray-700">{p.platform}</p>
                    <p className="text-sm text-gray-600">{p.direction}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded border border-gray-200 p-4">
              <p className="mb-2 text-sm font-medium">CTA</p>
              <p className="text-sm text-gray-600">{content.cta}</p>
            </section>
          </div>

          {formError && <p className="mt-4 text-sm text-red-600">{formError}</p>}

          <div className="mt-6 flex items-center gap-3">
            {status === "draft" && (
              <>
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Edit
                </button>
                {!confirmingApprove ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingApprove(true)}
                    className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    Approve
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <span>Confirm approval?</span>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={submitting}
                      className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {submitting ? "Approving…" : "Yes, approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingApprove(false)}
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
            {status === "approved" && (
              <div className="flex items-center gap-3">
                {existingContent && (
                  <Link
                    href={`/campaigns/${campaignId}/content`}
                    className="text-sm text-gray-600 underline"
                  >
                    View current content (v{existingContent.version}, {existingContent.status})
                  </Link>
                )}
                <GenerateContentButton campaignId={campaignId} />
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="rounded border border-gray-200 p-4">
            <p className="mb-2 text-sm font-medium">Target Audience Description</p>
            <textarea
              value={draft.targetAudience.description}
              onChange={(e) =>
                setDraft({ ...draft, targetAudience: { ...draft.targetAudience, description: e.target.value } })
              }
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
            />
            <div className="mt-3">
              <ListEditor
                label="Segments"
                items={draft.targetAudience.segments}
                onChange={(segments) =>
                  setDraft({ ...draft, targetAudience: { ...draft.targetAudience, segments } })
                }
              />
            </div>
          </section>

          <section className="rounded border border-gray-200 p-4">
            <ListEditor
              label="Customer Needs"
              items={draft.customerNeeds}
              onChange={(customerNeeds) => setDraft({ ...draft, customerNeeds })}
            />
          </section>

          <section className="rounded border border-gray-200 p-4">
            <p className="mb-2 text-sm font-medium">Positioning</p>
            <textarea
              value={draft.positioning}
              onChange={(e) => setDraft({ ...draft, positioning: e.target.value })}
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
            />
          </section>

          <section className="rounded border border-gray-200 p-4">
            <ListEditor
              label="Marketing Angles"
              items={draft.marketingAngles}
              onChange={(marketingAngles) => setDraft({ ...draft, marketingAngles })}
            />
          </section>

          <section className="rounded border border-gray-200 p-4">
            <p className="mb-2 text-sm font-medium">Messaging Pillars</p>
            <div className="flex flex-col gap-3">
              {draft.messagingPillars.map((pillar, index) => (
                <div key={index} className="flex flex-col gap-2 rounded border border-gray-100 p-3">
                  <div className="flex gap-2">
                    <input
                      value={pillar.title}
                      onChange={(e) => {
                        const next = [...draft.messagingPillars];
                        next[index] = { ...next[index], title: e.target.value };
                        setDraft({ ...draft, messagingPillars: next });
                      }}
                      placeholder="Title"
                      className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          messagingPillars: draft.messagingPillars.filter((_, i) => i !== index),
                        })
                      }
                      className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                    >
                      ×
                    </button>
                  </div>
                  <textarea
                    value={pillar.description}
                    onChange={(e) => {
                      const next = [...draft.messagingPillars];
                      next[index] = { ...next[index], description: e.target.value };
                      setDraft({ ...draft, messagingPillars: next });
                    }}
                    placeholder="Description"
                    rows={2}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  messagingPillars: [...draft.messagingPillars, { title: "", description: "" }],
                })
              }
              className="mt-2 self-start rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50"
            >
              + Add pillar
            </button>
          </section>

          <section className="rounded border border-gray-200 p-4">
            <p className="mb-2 text-sm font-medium">Platform Direction</p>
            <div className="flex flex-col gap-3">
              {draft.platformDirection.map((entry, index) => (
                <div key={index} className="flex flex-col gap-2 rounded border border-gray-100 p-3">
                  <div className="flex gap-2">
                    <select
                      value={entry.platform}
                      onChange={(e) => {
                        const next = [...draft.platformDirection];
                        next[index] = { ...next[index], platform: e.target.value as Platform };
                        setDraft({ ...draft, platformDirection: next });
                      }}
                      className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          platformDirection: draft.platformDirection.filter((_, i) => i !== index),
                        })
                      }
                      className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                    >
                      ×
                    </button>
                  </div>
                  <textarea
                    value={entry.direction}
                    onChange={(e) => {
                      const next = [...draft.platformDirection];
                      next[index] = { ...next[index], direction: e.target.value };
                      setDraft({ ...draft, platformDirection: next });
                    }}
                    placeholder="Direction"
                    rows={2}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  platformDirection: [...draft.platformDirection, { platform: "facebook", direction: "" }],
                })
              }
              className="mt-2 self-start rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50"
            >
              + Add platform direction
            </button>
          </section>

          <section className="rounded border border-gray-200 p-4">
            <p className="mb-2 text-sm font-medium">CTA</p>
            <input
              value={draft.cta}
              onChange={(e) => setDraft({ ...draft, cta: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
            />
          </section>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={submitting}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
