"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  marketingStrategyOutputSchema,
  type MarketingStrategyOutput,
} from "@/server/ai/schemas/marketing-strategy-output";
import { GenerateContentButton } from "@/components/campaign/content/generate-content-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

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
          <Input
            value={value}
            onChange={(e) => {
              const next = [...items];
              next[index] = e.target.value;
              onChange(next);
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            aria-label={`Remove ${label} item`}
          >
            ×
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => onChange([...items, ""])}>
        + Add
      </Button>
    </div>
  );
}

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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground">Strategy</h2>
        <span className="text-sm text-muted">Version {version}</span>
        <Badge status={status}>{status}</Badge>
      </div>

      {mode === "view" ? (
        <>
          <div className="flex flex-col divide-y divide-border">
            <section className="pb-7">
              <h3 className="mb-2.5 text-sm font-semibold text-foreground">Target audience</h3>
              <p className="mb-2 text-sm text-secondary">{content.targetAudience.description}</p>
              <ul className="list-inside list-disc text-sm text-secondary">
                {content.targetAudience.segments.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>

            <section className="py-7">
              <h3 className="mb-2.5 text-sm font-semibold text-foreground">Customer needs</h3>
              <ul className="list-inside list-disc text-sm text-secondary">
                {content.customerNeeds.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </section>

            <section className="py-7">
              <h3 className="mb-2.5 text-sm font-semibold text-foreground">Positioning</h3>
              <p className="text-sm text-secondary">{content.positioning}</p>
            </section>

            <section className="py-7">
              <h3 className="mb-2.5 text-sm font-semibold text-foreground">Marketing angles</h3>
              <ul className="list-inside list-disc text-sm text-secondary">
                {content.marketingAngles.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </section>

            <section className="py-7">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Messaging pillars</h3>
              <div className="flex flex-col gap-3">
                {content.messagingPillars.map((p, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-foreground">{p.title}</p>
                    <p className="text-sm text-secondary">{p.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="py-7">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Platform direction</h3>
              <div className="flex flex-col gap-3">
                {content.platformDirection.map((p, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium capitalize text-foreground">{p.platform}</p>
                    <p className="text-sm text-secondary">{p.direction}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="pt-7">
              <h3 className="mb-2.5 text-sm font-semibold text-foreground">Call to action</h3>
              <p className="text-sm text-secondary">{content.cta}</p>
            </section>
          </div>

          {formError && <p className="mt-4 text-sm text-error">{formError}</p>}

          <div className="mt-6 flex items-center gap-3">
            {status === "draft" && (
              <>
                <Button type="button" variant="secondary" onClick={startEdit}>
                  Edit
                </Button>
                {!confirmingApprove ? (
                  <Button type="button" onClick={() => setConfirmingApprove(true)}>
                    Approve
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <span>Confirm approval?</span>
                    <Button type="button" size="sm" onClick={handleApprove} isLoading={submitting}>
                      {submitting ? "Approving…" : "Yes, approve"}
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingApprove(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            )}
            {status === "approved" && (
              <div className="flex items-center gap-3">
                {existingContent && (
                  <Link href={`/campaigns/${campaignId}/content`} className="text-sm text-muted underline">
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
          <Card title="Target Audience Description">
            <Textarea
              value={draft.targetAudience.description}
              onChange={(e) =>
                setDraft({ ...draft, targetAudience: { ...draft.targetAudience, description: e.target.value } })
              }
              rows={2}
              className="w-full"
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
          </Card>

          <Card>
            <ListEditor
              label="Customer Needs"
              items={draft.customerNeeds}
              onChange={(customerNeeds) => setDraft({ ...draft, customerNeeds })}
            />
          </Card>

          <Card title="Positioning">
            <Textarea
              value={draft.positioning}
              onChange={(e) => setDraft({ ...draft, positioning: e.target.value })}
              rows={3}
              className="w-full"
            />
          </Card>

          <Card>
            <ListEditor
              label="Marketing Angles"
              items={draft.marketingAngles}
              onChange={(marketingAngles) => setDraft({ ...draft, marketingAngles })}
            />
          </Card>

          <Card title="Messaging Pillars">
            <div className="flex flex-col gap-3">
              {draft.messagingPillars.map((pillar, index) => (
                <div key={index} className="flex flex-col gap-2 rounded border border-border p-3">
                  <div className="flex gap-2">
                    <Input
                      value={pillar.title}
                      onChange={(e) => {
                        const next = [...draft.messagingPillars];
                        next[index] = { ...next[index], title: e.target.value };
                        setDraft({ ...draft, messagingPillars: next });
                      }}
                      placeholder="Title"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          messagingPillars: draft.messagingPillars.filter((_, i) => i !== index),
                        })
                      }
                    >
                      ×
                    </Button>
                  </div>
                  <Textarea
                    value={pillar.description}
                    onChange={(e) => {
                      const next = [...draft.messagingPillars];
                      next[index] = { ...next[index], description: e.target.value };
                      setDraft({ ...draft, messagingPillars: next });
                    }}
                    placeholder="Description"
                    rows={2}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2 self-start"
              onClick={() =>
                setDraft({
                  ...draft,
                  messagingPillars: [...draft.messagingPillars, { title: "", description: "" }],
                })
              }
            >
              + Add pillar
            </Button>
          </Card>

          <Card title="Platform Direction">
            <div className="flex flex-col gap-3">
              {draft.platformDirection.map((entry, index) => (
                <div key={index} className="flex flex-col gap-2 rounded border border-border p-3">
                  <div className="flex gap-2">
                    <Select
                      value={entry.platform}
                      onChange={(e) => {
                        const next = [...draft.platformDirection];
                        next[index] = { ...next[index], platform: e.target.value as Platform };
                        setDraft({ ...draft, platformDirection: next });
                      }}
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          platformDirection: draft.platformDirection.filter((_, i) => i !== index),
                        })
                      }
                    >
                      ×
                    </Button>
                  </div>
                  <Textarea
                    value={entry.direction}
                    onChange={(e) => {
                      const next = [...draft.platformDirection];
                      next[index] = { ...next[index], direction: e.target.value };
                      setDraft({ ...draft, platformDirection: next });
                    }}
                    placeholder="Direction"
                    rows={2}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2 self-start"
              onClick={() =>
                setDraft({
                  ...draft,
                  platformDirection: [...draft.platformDirection, { platform: "facebook", direction: "" }],
                })
              }
            >
              + Add platform direction
            </Button>
          </Card>

          <Card title="CTA">
            <Input value={draft.cta} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} className="w-full" />
          </Card>

          {formError && <p className="text-sm text-error">{formError}</p>}

          <div className="flex items-center gap-3">
            <Button type="button" onClick={handleSave} isLoading={submitting}>
              {submitting ? "Saving…" : "Save Changes"}
            </Button>
            <Button type="button" variant="secondary" onClick={cancelEdit} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
