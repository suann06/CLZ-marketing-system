"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ContentSetOutput } from "@/server/ai/schemas/content-set-output";
import { PageContainer } from "@/components/layout/page-container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Platform = keyof Omit<ContentSetOutput, "whatsapp">;
const PLATFORMS: Platform[] = ["facebook", "instagram", "tiktok"];
const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

type LaunchInfo = {
  id: string;
  platform: Platform;
  variantIndex: number;
  status: "pending" | "launching" | "live" | "failed" | "cancelled";
  provider: string | null;
  externalCampaignId: string | null;
  externalAdId: string | null;
  externalCreativeId: string | null;
  failureReason: string | null;
  launchedAt: string | null;
  createdAt: string;
};

function latestFor(launches: LaunchInfo[], platform: Platform): LaunchInfo | null {
  const forPlatform = launches.filter((l) => l.platform === platform);
  if (forPlatform.length === 0) return null;
  return [...forPlatform].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

export function LaunchPanel({
  campaignId,
  campaignName,
  productPromotion,
  approvedStrategyVersion,
  contentSetVersion,
  content,
  initialLaunches,
}: {
  campaignId: string;
  campaignName: string;
  productPromotion: string;
  approvedStrategyVersion: number | null;
  contentSetVersion: number;
  content: ContentSetOutput;
  initialLaunches: LaunchInfo[];
}) {
  const router = useRouter();

  const [launches, setLaunches] = useState<LaunchInfo[]>(initialLaunches);
  const [selectedIndex, setSelectedIndex] = useState<Record<Platform, number>>({
    facebook: 0,
    instagram: 0,
    tiktok: 0,
  });
  const [confirmingPlatform, setConfirmingPlatform] = useState<Platform | null>(null);
  const [submittingPlatform, setSubmittingPlatform] = useState<Platform | null>(null);
  const [errorByPlatform, setErrorByPlatform] = useState<Record<string, string>>({});
  const [clickResultByLaunch, setClickResultByLaunch] = useState<Record<string, string>>({});
  const [simulatingLaunchId, setSimulatingLaunchId] = useState<string | null>(null);

  // Stage 7/8 demo: calls the real deterministic tracking-link endpoint
  // (campaignId is derived server-side from this Launch, never trusted from
  // the client) exactly as a real ad-platform click-through would, so the
  // resulting AcquisitionEvent is genuinely attributed to this Launch — not
  // a fabricated shortcut.
  async function handleSimulateClick(launchId: string) {
    setSimulatingLaunchId(launchId);
    try {
      const res = await fetch(`/api/acquisition/track/${launchId}`);
      const body = await res.json().catch(() => null);
      setClickResultByLaunch((prev) => ({
        ...prev,
        [launchId]: res.ok
          ? `Click recorded (AcquisitionEvent ${body?.event?.id}).`
          : typeof body?.error === "string"
            ? body.error
            : "Could not simulate this click.",
      }));
    } catch {
      setClickResultByLaunch((prev) => ({ ...prev, [launchId]: "Could not reach the server." }));
    } finally {
      setSimulatingLaunchId(null);
    }
  }

  async function handleLaunch(platform: Platform) {
    setErrorByPlatform((prev) => ({ ...prev, [platform]: "" }));
    setSubmittingPlatform(platform);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, variantIndex: selectedIndex[platform] }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErrorByPlatform((prev) => ({
          ...prev,
          [platform]: typeof body?.error === "string" ? body.error : "Could not launch. Please try again.",
        }));
        return;
      }

      const { launch } = (await res.json()) as { launch: LaunchInfo };
      setLaunches((prev) => [...prev.filter((l) => l.id !== launch.id), launch]);
      setConfirmingPlatform(null);
      router.refresh();
    } catch {
      setErrorByPlatform((prev) => ({ ...prev, [platform]: "Could not reach the server. Please try again." }));
    } finally {
      setSubmittingPlatform(null);
    }
  }

  return (
    <PageContainer maxWidth="max-w-3xl">
      <h2 className="mb-1 text-lg font-semibold">Launch</h2>
      <p className="mb-1 text-sm text-muted">
        {campaignName} · {productPromotion}
      </p>
      <p className="mb-6 text-sm text-muted">
        Approved strategy: {approvedStrategyVersion !== null ? `v${approvedStrategyVersion}` : "—"} · Approved
        content: v{contentSetVersion}
      </p>

      <div className="mb-6 rounded border border-warning bg-warning-bg p-3 text-sm text-warning">
        <strong>Development mode:</strong> the current publishing provider is a <strong>stub</strong>. Launching
        here does <strong>not</strong> publish a real advertisement on Facebook, Instagram, or TikTok — it only
        records a simulated result for testing this workflow.
      </div>

      <div className="flex flex-col gap-6">
        {PLATFORMS.map((platform) => {
          const variants = content[platform];
          const latest = latestFor(launches, platform);
          const isLive = latest?.status === "live";
          const isInProgress = latest?.status === "pending" || latest?.status === "launching";
          const selected = variants[selectedIndex[platform]] ?? variants[0];

          return (
            <Card
              key={platform}
              title={PLATFORM_LABELS[platform]}
              action={latest && <Badge status={latest.status}>{latest.status}</Badge>}
            >
              {isLive && latest && (
                <div className="text-sm text-muted">
                  <p>Provider: {latest.provider ?? "—"}</p>
                  <p>External campaign ID: {latest.externalCampaignId}</p>
                  <p>External ad ID: {latest.externalAdId}</p>
                  {latest.launchedAt && <p>Launched: {new Date(latest.launchedAt).toLocaleString()}</p>}

                  <div className="mt-3 rounded border border-border bg-surface-muted p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                      Stage 7 — Launch tracking link (deterministic, derived from this Launch)
                    </p>
                    <code className="block break-all text-xs text-foreground">
                      /api/acquisition/track/{latest.id}
                    </code>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onClick={() => handleSimulateClick(latest.id)}
                      isLoading={simulatingLaunchId === latest.id}
                    >
                      {simulatingLaunchId === latest.id ? "Simulating…" : "Simulate Click (Stage 8)"}
                    </Button>
                    {clickResultByLaunch[latest.id] && (
                      <p className="mt-2 text-xs text-muted">{clickResultByLaunch[latest.id]}</p>
                    )}
                  </div>
                </div>
              )}

              {isInProgress && <p className="text-sm text-muted">Launch is in progress…</p>}

              {!isLive && !isInProgress && (
                <>
                  {latest?.status === "failed" && (
                    <p className="mb-3 text-sm text-error">
                      Previous attempt failed: {latest.failureReason}
                    </p>
                  )}

                  <div className="mb-3 flex flex-col gap-2">
                    {variants.map((variant, index) => (
                      <label key={index} className="flex items-start gap-2 text-sm">
                        <input
                          type="radio"
                          name={`${platform}-variant`}
                          checked={selectedIndex[platform] === index}
                          onChange={() => setSelectedIndex((prev) => ({ ...prev, [platform]: index }))}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium">{variant.variantLabel}</span> — {variant.headline}
                        </span>
                      </label>
                    ))}
                  </div>

                  {selected && (
                    <div className="mb-3 rounded border border-border p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                        Customer-facing preview
                      </p>
                      <p className="mb-1 text-sm font-medium text-foreground">{selected.headline}</p>
                      <p className="mb-2 text-sm text-muted">{selected.bodyText}</p>
                      <p className="mb-2 text-sm font-medium text-foreground">CTA: {selected.cta}</p>
                      {selected.hashtags && selected.hashtags.length > 0 && (
                        <p className="text-sm text-muted">{selected.hashtags.join(" ")}</p>
                      )}
                    </div>
                  )}

                  {errorByPlatform[platform] && (
                    <p className="mb-2 text-sm text-error">{errorByPlatform[platform]}</p>
                  )}

                  {confirmingPlatform !== platform ? (
                    <Button type="button" onClick={() => setConfirmingPlatform(platform)}>
                      {latest?.status === "failed" ? "Retry Launch" : `Launch to ${PLATFORM_LABELS[platform]}`}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <span>Confirm launch to {PLATFORM_LABELS[platform]} (development stub)?</span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleLaunch(platform)}
                        isLoading={submittingPlatform === platform}
                      >
                        {submittingPlatform === platform ? "Launching…" : "Yes, launch"}
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingPlatform(null)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-muted">
        WhatsApp content from this ContentSet is not published from this page — it is used separately in Phase 3
        customer messaging.
      </p>

      <p className="mt-4">
        <Link href={`/campaigns/${campaignId}/leads`} className="text-sm underline">
          Continue to Leads (Stage 9 — simulate a WhatsApp enquiry) →
        </Link>
      </p>
    </PageContainer>
  );
}
