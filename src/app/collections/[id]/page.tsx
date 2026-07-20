"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchCollections } from "@/lib/api/user";
import { useAuthStore } from "@/stores/auth-store";

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const user = useAuthStore((s) => s.user);

  const { data } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
    enabled: Boolean(user),
  });

  const collection = data?.items.find((c) => c.id === id);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6">
      <Link href="/collections" className="text-sm text-[var(--primary-light)]">
        ← Collections
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold">
        {collection?.name ?? "Collection"}
      </h1>
      <p className="mt-2 text-[var(--text-muted)]">
        {collection?.description || "No description."}
      </p>
      <p className="mt-4 text-sm text-[var(--text-muted)]">
        {collection?.itemCount ?? 0} items
      </p>
    </div>
  );
}
