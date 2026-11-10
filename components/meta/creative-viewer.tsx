"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Play } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/states";
import { formatInr } from "@/lib/meta/insights";
import type { ClientCreativeView } from "@/lib/meta/client-dto";
import { cn } from "@/lib/utils";

type Props = {
  adId: string | null;
  slug: string;
  owner?: boolean;
  range?: string;
  onClose: () => void;
};

function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e7) return `${(value / 1e7).toFixed(1)}Cr`;
  if (Math.abs(value) >= 1e5) return `${(value / 1e5).toFixed(1)}L`;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;
}

export function CreativeViewer({ adId, slug, owner = false, range = "7d", onClose }: Props) {
  const [view, setView] = useState<ClientCreativeView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!adId) { setView(null); setError(""); return; }
    let cancelled = false;
    setLoading(true);
    setError("");
    const endpoint = owner ? "/api/meta/owner/creative" : "/api/meta/client/creative";
    const params = new URLSearchParams({ range, platform: "all" });
    if (!owner) params.set("state", slug);
    void fetch(`${endpoint}/${encodeURIComponent(adId)}?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Creative is not available");
        const payload = await response.json();
        if (!cancelled) setView(payload.creative ?? null);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Creative is not available"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [adId, owner, slug, range]);

  const creative = view?.creative ?? null;
  const mediaSource = adId ? `/api/meta/creative/${encodeURIComponent(adId)}/media?${owner ? "" : `state=${encodeURIComponent(slug)}&`}range=${range}` : "";
  const hasVideo = Boolean(creative?.videoId);
  const image = creative?.imageUrl ?? creative?.thumbnailUrl ?? null;

  return (
    <Dialog
      open={Boolean(adId)}
      onClose={onClose}
      title={view?.name ?? "Creative"}
      description="Live Meta creative · 30-minute media cache"
      className="max-w-2xl"
    >
      {loading && !view ? (
        <div className="flex items-center gap-2 py-10 text-[12px] text-[var(--text-muted)]" aria-live="polite">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> Loading creative…
        </div>
      ) : error && !view ? (
        <EmptyState title={error} />
      ) : (
        <div className="space-y-3">
          {hasVideo ? (
            <video
              key={mediaSource}
              controls
              playsInline
              preload="metadata"
              poster={creative?.thumbnailUrl ?? undefined}
              className="w-full rounded-[var(--radius-control)] bg-black"
            >
              <source src={mediaSource} type="video/mp4" />
              <track kind="captions" />
            </video>
          ) : image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={creative?.title ?? view?.name ?? "Ad creative"} className="w-full rounded-[var(--radius-control)]" />
          ) : creative?.instagramPermalinkUrl ? (
            <div className="rounded-[var(--radius-control)] border border-[var(--border-hairline)] p-4">
              <p className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]"><Play className="size-3.5" /> This creative is hosted on Instagram.</p>
              <Link href={creative.instagramPermalinkUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1 text-[12px] font-semibold text-[var(--accent-brass-strong)]">
                Open on Instagram <ExternalLink className="size-3" />
              </Link>
            </div>
          ) : (
            <EmptyState title="No creative media is available for this ad." />
          )}

          {(creative?.title || creative?.body) && (
            <div>
              {creative?.title && <p className="text-[13px] font-semibold text-[var(--text-primary)]">{creative.title}</p>}
              {creative?.body && <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">{creative.body}</p>}
            </div>
          )}

          <dl className={cn("grid gap-2 text-[12px]", owner ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
            <div><dt className="text-[var(--text-muted)]">Impressions</dt><dd className="num font-semibold">{formatCount(view?.metrics.impressions)}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Reach</dt><dd className="num font-semibold">{formatCount(view?.metrics.reach)}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Clicks · CTR</dt><dd className="num font-semibold">{formatCount(view?.metrics.clicks)} · {formatPct(view?.metrics.ctr)}</dd></div>
            <div><dt className="text-[var(--text-muted)]">ThruPlays</dt><dd className="num font-semibold">{formatCount(view?.metrics.thruPlays)}</dd></div>
            {owner && (
              <>
                <div><dt className="text-[var(--text-muted)]">Spend</dt><dd className="num font-semibold">{formatInr(view?.metrics.spend ?? null)}</dd></div>
                <div><dt className="text-[var(--text-muted)]">CPM · CPC</dt><dd className="num font-semibold">{formatInr(view?.metrics.cpm ?? null)} · {formatInr(view?.metrics.cpc ?? null)}</dd></div>
              </>
            )}
          </dl>

          {creative?.instagramPermalinkUrl && (hasVideo || image) && (
            <Link href={creative.instagramPermalinkUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 text-[12px] font-semibold text-[var(--accent-brass-strong)]">
              Open on Instagram <ExternalLink className="size-3" />
            </Link>
          )}
        </div>
      )}
    </Dialog>
  );
}
