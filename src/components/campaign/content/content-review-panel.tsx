"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  contentSetOutputSchema,
  type ContentSetOutput,
  type ContentVariant,
} from "@/server/ai/schemas/content-set-output";

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

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  approved: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-400",
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
      <p className="text-xs font-medium text-gray-600">Hashtags (optional)</p>
      {hashtags.map((value, index) => (
        <div key={index} className="flex gap-2">
          <input
            value={value}
            onChange={(e) => {
              const next = [...hashtags];
              next[index] = e.target.value;
              onChange(next);
            }}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-gray-500"
          />
          <button
            type="button"
            onClick={() => onChange(hashtags.filter((_, i) => i !== index))}
            aria-label="Remove hashtag"
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...hashtags, ""])}
        className="self-start rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50"
      >
        + Add hashtag
      </button>
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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold">Marketing Content</h1>
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
            {PLATFORMS.map((platform) => (
              <section key={platform} className="rounded border border-gray-200 p-4">
                <p className="mb-3 text-sm font-semibold">
                  {PLATFORM_LABELS[platform]} ({content[platform].length})
                </p>
                <div className="flex flex-col gap-4">
                  {content[platform].map((variant, i) => (
                    <div key={i} className="rounded border border-gray-100 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                        {variant.variantLabel}
                      </p>
                      <p className="mb-1 text-sm font-medium text-gray-800">{variant.headline}</p>
                      <p className="mb-2 text-sm text-gray-600">{variant.bodyText}</p>
                      <p className="mb-2 text-sm font-medium text-gray-700">CTA: {variant.cta}</p>
                      {variant.hashtags && variant.hashtags.length > 0 && (
                        <p className="mb-2 text-sm text-gray-500">{variant.hashtags.join(" ")}</p>
                      )}
                      {variant.notes && (
                        <div className="mt-2 rounded bg-yellow-50 p-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-yellow-700">
                            Internal note — not customer-facing
                          </p>
                          <p className="text-xs text-yellow-800">{variant.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {formError && <p className="mt-4 text-sm text-red-600">{formError}</p>}

          {status === "draft" && (
            <div className="mt-6 flex flex-col gap-3">
              <p className="text-sm text-gray-500">
                {variantCounts.map(({ platform, count }) => `${PLATFORM_LABELS[platform]}: ${count}`).join(" · ")}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Edit
                </button>
                {!canApprove ? (
                  <p className="text-sm text-red-600">
                    Every platform needs at least one complete variant before this can be approved.
                  </p>
                ) : !confirmingApprove ? (
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
              </div>
            </div>
          )}
          {status === "approved" && (
            <div className="mt-6">
              <Link
                href={`/campaigns/${campaignId}/launch`}
                className="inline-block rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              >
                Proceed to Launch
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-8">
          {PLATFORMS.map((platform) => (
            <section key={platform} className="rounded border border-gray-200 p-4">
              <p className="mb-3 text-sm font-semibold">
                {PLATFORM_LABELS[platform]} ({draft[platform].length})
              </p>
              <div className="flex flex-col gap-4">
                {draft[platform].map((variant, index) => (
                  <div key={index} className="flex flex-col gap-2 rounded border border-gray-100 p-3">
                    <div className="flex gap-2">
                      <input
                        value={variant.variantLabel}
                        onChange={(e) => updateVariant(platform, index, { variantLabel: e.target.value })}
                        placeholder="Variant label (e.g. Angle: Speed)"
                        className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeVariant(platform, index)}
                        aria-label="Remove variant"
                        className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                      >
                        × Remove variant
                      </button>
                    </div>
                    <input
                      value={variant.headline}
                      onChange={(e) => updateVariant(platform, index, { headline: e.target.value })}
                      placeholder="Headline"
                      className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                    />
                    <textarea
                      value={variant.bodyText}
                      onChange={(e) => updateVariant(platform, index, { bodyText: e.target.value })}
                      placeholder="Body text"
                      rows={3}
                      className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                    />
                    <input
                      value={variant.cta}
                      onChange={(e) => updateVariant(platform, index, { cta: e.target.value })}
                      placeholder="CTA"
                      className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                    />
                    <HashtagEditor
                      hashtags={variant.hashtags ?? []}
                      onChange={(hashtags) => updateVariant(platform, index, { hashtags })}
                    />
                    <div>
                      <p className="mb-1 text-xs font-medium text-yellow-700">
                        Internal note — not customer-facing
                      </p>
                      <textarea
                        value={variant.notes ?? ""}
                        onChange={(e) => updateVariant(platform, index, { notes: e.target.value })}
                        placeholder="Reviewer notes (optional)"
                        rows={2}
                        className="w-full rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm outline-none focus:border-yellow-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => addVariant(platform)}
                className="mt-3 self-start rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50"
              >
                + Add {PLATFORM_LABELS[platform]} variant
              </button>
            </section>
          ))}

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
