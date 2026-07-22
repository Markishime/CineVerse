"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { createCollection, fetchCollections } from "@/lib/api/user";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";

export default function CollectionsPage() {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
    enabled: Boolean(user),
  });

  const createMut = useMutation({
    mutationFn: () => createCollection({ name, isPublic: true }),
    onSuccess: () => {
      setName("");
      void qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  if (!user) {
    return (
      <div className="page-shell max-w-lg text-center">
        <PageHeader
          title="Collections"
          description="Sign in to create custom collections."
          className="justify-center [&>div]:mx-auto"
        />
        <Link href="/login" className="mt-8 inline-block">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6">
      <PageHeader
        eyebrow="Curate"
        title="Collections"
        description="Group titles into public or private lists you can share."
      />

      <form
        className="mt-8 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createMut.mutate();
        }}
      >
        <Input
          className="h-11"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection name"
          aria-label="Collection name"
        />
        <Button type="submit" className="h-11" disabled={createMut.isPending}>
          Create
        </Button>
      </form>

      {isLoading && (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <ul className="mt-8 space-y-3">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/collections/${c.id}`}
                className="block rounded-xl border border-white/10 bg-[var(--surface)] p-4 transition-colors hover:border-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <p className="font-display font-semibold text-white">{c.name}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {c.itemCount} items · {c.isPublic ? "Public" : "Private"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && items.length === 0 && (
        <EmptyState
          className="mt-10"
          icon={FolderOpen}
          title="No collections yet"
          description="Create a collection above to start curating titles."
        />
      )}
    </div>
  );
}
