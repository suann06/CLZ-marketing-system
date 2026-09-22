"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  contentSetOutputSchema,
  type ContentSetOutput,
  type ContentVariant,
} from "@/server/ai/schemas/content-set-output";
import { PageContainer } from "@/components/layout/page-container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Platform = keyof ContentSetOutput;
const PLATFORMS: Platform[] = ["facebook", "instagram", "tiktok", "whatsapp"];
const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

const EMPTY_VARIANT: ContentVariant = {
  variantLabel: "",
  headline: "",
  bodyText: "",
  cta: "",
  hashtags: [],
  notes: "",
};

function HashtagEditor({
  hashtags,
  onChange,
}: {
  hashtags: string[];
  onChange: (hashtags: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted">Hashtags (optional)</p>
      {hashtags.map((value, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => {
              const next = [...hashtags];
              next[index] = e.target.value;
              onChange(next);
            }}
            className="flex-1"
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange(hashtags.filter((_, i) => i !== index))} aria-label="Remove hashtag">
            ×
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => onChange([...hashtags, ""])}>
        + Add hashtag
      </Button>
    </div>
  );
}

export function ContentReviewPanel({
  campaignId,
  contentSetId: initialContentSetId,
  content: initialContent,
  version: initialVersion,
  status: initialStatus,
}: {
  campaignId: string;
  contentSetId: string;
  content: ContentSetOutput;
  version: number;
  status: string;
}) {
  const router = useRouter();

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [contentSetId, setContentSetId] = useState(initialContentSetId);
  const [content, setContent] = useState(initialContent);
  const [version, setVersion] = useState(initialVersion);
  const [status, setStatus] = useState(initialStatus);
  const [draft, setDraft] = useState<ContentSetOutput>(initialContent);

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

  function updateVariant(platform: Platform, index: number, patch: Partial<ContentVariant>) {
    const next = { ...draft, [platform]: [...draft[platform]] };
    next[platform][index] = { ...next[platform][index], ...patch };
    setDraft(next);
  }

  function addVariant(platform: Platform) {
    setDraft({ ...draft, [platform]: [...draft[platform], { ...EMPTY_VARIANT }] });
  }

  function removeVariant(platform: Platform, index: number) {
    setDraft({ ...draft, [platform]: draft[platform].filter((_, i) => i !== index) });
  }

  async function handleSave() {
    setFormError(null);

    // Hashtags/notes default to [] / "" locally for editing convenience;
    // strip empty ones back out before validating/submitting so optional
    // fields stay genuinely optional rather than becoming empty arrays/
    // strings in storage.
    const cleaned: ContentSetOutput = {
      facebook: draft.facebook.map(cleanVariant),
      instagram: draft.instagram.map(cleanVariant),
      tiktok: draft.tiktok.map(cleanVariant),
      whatsapp: draft.whatsapp.map(cleanVariant),
    };

    const parsed = contentSetOutputSchema.safeParse(cleaned);
    if (!parsed.success) {
      setFormError("Each platform needs at least one variant with a label, headline, body, and CTA filled in.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/content/${contentSetId}`, {
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

      const { contentSet } = (await res.json()) as {
        contentSet: { id: string; version: number; status: string; content: ContentSetOutput };
      };
      setContentSetId(contentSet.id);
      setContent(contentSet.content);
      setVersion(contentSet.version);
      setStatus(contentSet.status);
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
      const res = await fetch(`/api/campaigns/${campaignId}/content/${contentSetId}/approve`, {
        method: "POST",
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(
          typeof body?.error === "string" ? body.error : "Could not approve this content. Please try again.",
        );
        return;
      }

      const { contentSet } = (await res.json()) as { contentSet: { status: string } };
      setStatus(contentSet.status);
      setConfirmingApprove(false);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const variantCounts = useMemo(
    () => PLATFORMS.map((p) => ({ platform: p, count: content[p].length })),
    [content],
  );
  const canApprove = useMemo(() => contentSetOutputSchema.safeParse(content).success, [content]);

  return (
    <PageContainer maxWidth="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-lg font-semibold">Content</h2>
        <span className="text-sm text-muted">Version {version}</span>
        <Badge status={status}>{status}</Badge>
      </div>

      {mode === "view" ? (
        <>
          <div className="flex flex-col gap-6">
            {PLATFORMS.map((platform) => (
              <Card key={platform} title={`${PLATFORM_LABELS[platform]} (${content[platform].length})`}>
                <div className="divide-y divide-border">
                  {content[platform].map((variant, i) => (
                    <div key={i} className={i === 0 ? "pb-4" : "py-4"}>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                        {variant.variantLabel}
                      </p>
                      <p className="mb-1 text-sm font-medium text-foreground">{variant.headline}</p>
                      <p className="mb-2 text-sm text-muted">{variant.bodyText}</p>
                      <p className="mb-2 text-sm font-medium text-foreground">CTA: {variant.cta}</p>
                      {variant.hashtags && variant.hashtags.length > 0 && (
                        <p className="mb-2 text-sm text-muted">{variant.hashtags.join(" ")}</p>
                      )}
                      {variant.notes && (
                        <div className="mt-2 border-l-2 border-warning pl-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-warning">
                            Internal note — not customer-facing
                          </p>
                          <p className="text-xs text-secondary">{variant.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {formError && <p className="mt-4 text-sm text-error">{formError}</p>}

          {status === "draft" && (
            <div className="mt-6 flex flex-col gap-3">
              <p className="text-sm text-muted">
                {variantCounts.map(({ platform, count }) => `${PLATFORM_LABELS[platform]}: ${count}`).join(" · ")}
              </p>
              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" onClick={startEdit}>
                  Edit
                </Button>
                {!canApprove ? (
                  <p className="text-sm text-error">
                    Every platform needs at least one complete variant before this can be approved.
                  </p>
                ) : !confirmingApprove ? (
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
              </div>
            </div>
          )}
          {status === "approved" && (
            <div className="mt-6">
              <Link href={`/campaigns/${campaignId}/launch`}>
                <Button type="button">Proceed to Launch</Button>
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-8">
          {PLATFORMS.map((platform) => (
            <Card key={platform} title={`${PLATFORM_LABELS[platform]} (${draft[platform].length})`}>
              <div className="flex flex-col gap-4">
                {draft[platform].map((variant, index) => (
                  <div key={index} className="flex flex-col gap-2 rounded border border-border p-3">
                    <div className="flex gap-2">
                      <Input
                        value={variant.variantLabel}
                        onChange={(e) => updateVariant(platform, index, { variantLabel: e.target.value })}
                        placeholder="Variant label (e.g. Angle: Speed)"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => removeVariant(platform, index)}
                        aria-label="Remove variant"
                      >
                        × Remove variant
                      </Button>
                    </div>
                    <Input
                      value={variant.headline}
                      onChange={(e) => updateVariant(platform, index, { headline: e.target.value })}
                      placeholder="Headline"
                    />
                    <Textarea
                      value={variant.bodyText}
                      onChange={(e) => updateVariant(platform, index, { bodyText: e.target.value })}
                      placeholder="Body text"
                      rows={3}
                    />
                    <Input
                      value={variant.cta}
                      onChange={(e) => updateVariant(platform, index, { cta: e.target.value })}
                      placeholder="CTA"
                    />
                    <HashtagEditor
                      hashtags={variant.hashtags ?? []}
                      onChange={(hashtags) => updateVariant(platform, index, { hashtags })}
                    />
                    <div>
                      <p className="mb-1 text-xs font-medium text-warning">
                        Internal note — not customer-facing
                      </p>
                      <Textarea
                        value={variant.notes ?? ""}
                        onChange={(e) => updateVariant(platform, index, { notes: e.target.value })}
                        placeholder="Reviewer notes (optional)"
                        rows={2}
                        className="w-full border-warning bg-warning-bg"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" size="sm" className="mt-3 self-start" onClick={() => addVariant(platform)}>
                + Add {PLATFORM_LABELS[platform]} variant
              </Button>
            </Card>
          ))}

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
    </PageContainer>
  );
}

function cleanVariant(variant: ContentVariant): ContentVariant {
  const hashtags = (variant.hashtags ?? []).map((h) => h.trim()).filter(Boolean);
  const notes = variant.notes?.trim();
  return {
    variantLabel: variant.variantLabel,
    headline: variant.headline,
    bodyText: variant.bodyText,
    cta: variant.cta,
    ...(hashtags.length > 0 ? { hashtags } : {}),
    ...(notes ? { notes } : {}),
  };
}
