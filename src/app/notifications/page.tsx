"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchNotifications } from "@/lib/api/user";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-32 text-center">
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Sign in to receive airing alerts and recommendations.
        </p>
        <Link href="/login" className="mt-4 inline-block">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Notifications</h1>
      {isLoading && (
        <p className="mt-6 text-sm text-[var(--text-muted)]">Loading…</p>
      )}
      <ul className="mt-8 space-y-3">
        {(data?.items ?? []).map((n) => (
          <li
            key={n.id}
            className={`surface-card p-4 ${n.read ? "opacity-70" : ""}`}
          >
            <p className="font-medium">{n.title}</p>
            <p className="text-sm text-[var(--text-muted)]">{n.body}</p>
          </li>
        ))}
      </ul>
      {(data?.items ?? []).length === 0 && !isLoading && (
        <p className="mt-8 text-[var(--text-muted)]">You&apos;re all caught up.</p>
      )}
    </div>
  );
}
