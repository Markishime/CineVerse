"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { apiFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Dashboard {
  contentTotals: Record<string, number>;
  userTotals: { approx: number; note: string };
  pendingReviews: number;
  openReports: number;
  failedSyncJobs: unknown[];
  providerStatus: Array<{ name: string; status: string }>;
  duplicateCandidates: unknown[];
  classificationIssues: unknown[];
  rightsExpiringSoon: unknown[];
}

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuthStore();
  const qc = useQueryClient();

  const { data, isError, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiFetch<Dashboard>("/admin/dashboard"),
    enabled: Boolean(user),
    retry: false,
  });

  const syncMut = useMutation({
    mutationFn: (jobType: string) =>
      apiFetch(`/admin/sync/${jobType}`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-dashboard"] }),
  });

  if (loading) {
    return <div className="pt-24 mx-4 h-40 skeleton rounded-xl" />;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-32 text-center">
        <h1 className="font-display text-2xl font-bold">Admin</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Authentication required. Admin access uses Firebase custom claims.
        </p>
        <Link href="/login" className="mt-4 inline-block">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  if (isError || (!isAdmin && !data)) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-32 text-center">
        <h1 className="font-display text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          {(error as Error)?.message ??
            "Admin custom claim required. Users cannot self-assign admin roles."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-24 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Admin dashboard</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Content ops, moderation, sync, classification overrides, and rights.
      </p>

      {data && (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.contentTotals).map(([k, v]) => (
              <div key={k} className="surface-card p-4">
                <p className="text-xs uppercase text-[var(--text-muted)]">{k}</p>
                <p className="font-display text-2xl font-semibold">{v}</p>
              </div>
            ))}
          </div>

          <section className="mt-8 surface-card p-5">
            <h2 className="font-display text-lg font-semibold">Provider status</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {data.providerStatus.map((p) => (
                <li key={p.name} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-[var(--text-muted)]">{p.status}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8 surface-card p-5">
            <h2 className="font-display text-lg font-semibold">
              Cloudflare Stream (full movies / episodes)
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Upload owned or licensed files to Cloudflare Stream, then map each
              movie or episode to a <code className="text-[var(--primary-light)]">cloudflareVideoUid</code>.
              TMDB is metadata only — never a video file.
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
              <li>
                Set env:{" "}
                <code>CLOUDFLARE_ACCOUNT_ID</code>,{" "}
                <code>CLOUDFLARE_STREAM_TOKEN</code>,{" "}
                <code>NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE</code>
              </li>
              <li>
                <code>POST /api/v1/admin/stream/direct-upload</code> → get{" "}
                <code>uploadURL</code> + <code>uid</code>
              </li>
              <li>Upload the video file to <code>uploadURL</code></li>
              <li>
                <code>POST /api/v1/admin/playback-sources</code> with{" "}
                <code>sourceType: cloudflare_stream</code> and that{" "}
                <code>uid</code> (one source per episode)
              </li>
            </ol>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Full guide: docs/CLOUDFLARE_STREAM_SETUP.md
            </p>
          </section>

          <section className="mt-8 surface-card p-5">
            <h2 className="font-display text-lg font-semibold">
              Trigger synchronization
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {["trending", "popular", "anime_airing", "kdrama", "providers", "homepage", "daily"].map(
                (job) => (
                  <Button
                    key={job}
                    size="sm"
                    variant="secondary"
                    disabled={syncMut.isPending}
                    onClick={() => syncMut.mutate(job)}
                  >
                    {job}
                  </Button>
                ),
              )}
            </div>
            {syncMut.isSuccess && (
              <p className="mt-3 text-sm text-[var(--success)]">
                Job accepted and queued.
              </p>
            )}
          </section>

          <section className="mt-8 grid gap-3 sm:grid-cols-3 text-sm">
            <div className="surface-card p-4">
              Pending reviews: {data.pendingReviews}
            </div>
            <div className="surface-card p-4">
              Open reports: {data.openReports}
            </div>
            <div className="surface-card p-4">
              Rights expiring: {data.rightsExpiringSoon.length}
            </div>
          </section>

          <LegalPlaybackAdmin />
        </>
      )}
    </div>
  );
}

function LegalPlaybackAdmin() {
  const { data, isError, error, refetch } = useQuery({
    queryKey: ["admin-playback-sources"],
    queryFn: () =>
      apiFetch<{
        sources: Array<{
          id: string;
          titleId: string;
          sourceType: string;
          contentKind: string;
          status: string;
          providerName: string;
          rightsHolder: string;
        }>;
        policy: { tmdbIsMetadataOnly: boolean; banned: string[] };
      }>("/admin/playback-sources"),
  });

  const reviewMut = useMutation({
    mutationFn: (body: { id: string; status: string }) =>
      apiFetch("/admin/playback-sources", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => void refetch(),
  });

  return (
    <section className="mt-8 surface-card p-5">
      <h2 className="font-display text-lg font-semibold">
        Legal playback sources
      </h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Full in-app playback requires an approved rights record. TMDB is
        metadata only. No scraped streams, no Netflix/Disney+/Crunchyroll
        restreams.
      </p>
      {isError && (
        <p className="mt-3 text-sm text-[var(--danger)]">
          {(error as Error)?.message ?? "Failed to load sources"}
        </p>
      )}
      {data && (
        <>
          <p className="mt-3 text-xs text-[var(--success)]">
            Policy: tmdbIsMetadataOnly={String(data.policy.tmdbIsMetadataOnly)} ·
            banned: {data.policy.banned.slice(0, 3).join(", ")}…
          </p>
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto text-sm">
            {data.sources.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-white">
                    {s.titleId}{" "}
                    <span className="text-[var(--text-muted)]">
                      · {s.contentKind} · {s.sourceType}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {s.providerName} · {s.rightsHolder} · {s.status}
                  </p>
                </div>
                <div className="flex gap-1">
                  {s.status !== "approved" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={reviewMut.isPending}
                      onClick={() =>
                        reviewMut.mutate({ id: s.id, status: "approved" })
                      }
                    >
                      Approve
                    </Button>
                  )}
                  {s.status === "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewMut.isPending}
                      onClick={() =>
                        reviewMut.mutate({ id: s.id, status: "expired" })
                      }
                    >
                      Expire
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
