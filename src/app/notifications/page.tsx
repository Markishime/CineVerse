"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Bell } from "lucide-react";
import { fetchNotifications } from "@/lib/api/user";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";

export default function NotificationsPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <div className="page-shell max-w-lg text-center">
        <PageHeader
          title="Notifications"
          description="Sign in to receive airing alerts and recommendations."
          className="justify-center text-center [&>div]:mx-auto [&>div]:max-w-none"
        />
        <Link href="/login" className="mt-8 inline-block">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Airing alerts, product updates, and recommendations."
      />

      {isLoading && (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <ul className="mt-8 space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border border-white/10 bg-[var(--surface)] p-4 ${
                n.read ? "opacity-70" : ""
              }`}
            >
              <p className="font-medium text-white">{n.title}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{n.body}</p>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && items.length === 0 && (
        <EmptyState
          className="mt-10"
          icon={Bell}
          title="You're all caught up"
          description="New airing alerts and recommendations will land here."
          actions={[{ href: "/discover", label: "Discover", variant: "secondary" }]}
        />
      )}
    </div>
  );
}
