"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentSetOutput } from "@/server/ai/schemas/content-set-output";

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

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  launching: "bg-blue-100 text-blue-700",
  live: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold">Launch Campaign</h1>
      <p className="mb-1 text-sm text-gray-500">
        {campaignName} · {productPromotion}
      </p>
      <p className="mb-6 text-sm text-gray-500">
        Approved strategy: {approvedStrategyVersion !== null ? `v${approvedStrategyVersion}` : "—"} · Approved
        content: v{contentSetVersion}
      </p>

      <div className="mb-6 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
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
            <section key={platform} className="rounded border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">{PLATFORM_LABELS[platform]}</p>
                {latest && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[latest.status] ?? ""}`}
                  >
                    {latest.status}
                  </span>
                )}
              </div>

              {isLive && latest && (
                <div className="text-sm text-gray-600">
                  <p>Provider: {latest.provider ?? "—"}</p>
                  <p>External campaign ID: {latest.externalCampaignId}</p>
                  <p>External ad ID: {latest.externalAdId}</p>
                  {latest.launchedAt && <p>Launched: {new Date(latest.launchedAt).toLocaleString()}</p>}
                </div>
              )}

              {isInProgress && <p className="text-sm text-gray-600">Launch is in progress…</p>}

              {!isLive && !isInProgress && (
                <>
                  {latest?.status === "failed" && (
                    <p className="mb-3 text-sm text-red-600">
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
                    <div className="mb-3 rounded border border-gray-100 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                        Customer-facing preview
                      </p>
                      <p className="mb-1 text-sm font-medium text-gray-800">{selected.headline}</p>
                      <p className="mb-2 text-sm text-gray-600">{selected.bodyText}</p>
                      <p className="mb-2 text-sm font-medium text-gray-700">CTA: {selected.cta}</p>
                      {selected.hashtags && selected.hashtags.length > 0 && (
                        <p className="text-sm text-gray-500">{selected.hashtags.join(" ")}</p>
                      )}
                    </div>
                  )}

                  {errorByPlatform[platform] && (
                    <p className="mb-2 text-sm text-red-600">{errorByPlatform[platform]}</p>
                  )}

                  {confirmingPlatform !== platform ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingPlatform(platform)}
                      className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      {latest?.status === "failed" ? "Retry Launch" : `Launch to ${PLATFORM_LABELS[platform]}`}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <span>Confirm launch to {PLATFORM_LABELS[platform]} (development stub)?</span>
                      <button
                        type="button"
                        onClick={() => handleLaunch(platform)}
                        disabled={submittingPlatform === platform}
                        className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {submittingPlatform === platform ? "Launching…" : "Yes, launch"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingPlatform(null)}
                        className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-gray-500">
        WhatsApp content from this ContentSet is not published from this page — it is used separately in Phase 3
        customer messaging.
      </p>
    </div>
  );
}
