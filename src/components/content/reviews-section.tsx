"use client";

import { useEffect, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import type { Review } from "@/types/content";
import { removeReview, subscribeReviews } from "@/lib/user/reviews-client";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";

export function ReviewsSection({ contentId }: { contentId: string }) {
  const user = useAuthStore((s) => s.user);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [spoilerOpen, setSpoilerOpen] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    return subscribeReviews(contentId, (items) => {
      setReviews(items);
      setSynced(true);
    });
  }, [contentId]);

  return (
    <section className="mt-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Reviews
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {synced ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" />
                Updated · {reviews.length} review
                {reviews.length === 1 ? "" : "s"}
              </span>
            ) : (
              "Loading…"
            )}
          </p>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-[var(--text-secondary)] underline-offset-2 hover:text-white hover:underline"
          onClick={() => setSpoilerOpen((v) => !v)}
        >
          Spoilers: {spoilerOpen ? "shown" : "hidden"}
        </button>
      </div>

      <ul className="space-y-3">
        {reviews.length === 0 && (
          <li className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            No reviews yet.
          </li>
        )}
        {reviews.map((r) => {
          const hide = r.hasSpoilers && !spoilerOpen;
          return (
            <li
              key={r.id}
              className="rounded-xl border border-white/10 bg-[var(--surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">
                    @{r.username}
                    {r.title ? (
                      <span className="text-[var(--text-secondary)]">
                        {" "}
                        · {r.title}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--gold)]">
                    <Star className="h-3 w-3 fill-current" />
                    {r.rating.toFixed(1)} / 10
                    <span className="ml-2 text-[var(--text-muted)]">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.hasSpoilers && <Badge tone="accent">Spoilers</Badge>}
                  {user?.uid === r.uid && (
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--danger)]"
                      aria-label="Delete review"
                      onClick={() => void removeReview(r.id, contentId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {hide ? (
                <button
                  type="button"
                  onClick={() => setSpoilerOpen(true)}
                  className="mt-3 w-full rounded-lg bg-white/5 px-3 py-4 text-sm text-[var(--text-secondary)] hover:bg-white/10"
                >
                  Hidden for spoilers — click to reveal all spoilers
                </button>
              ) : (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                  {r.body}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
