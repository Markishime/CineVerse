"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  createCollection,
  fetchCollections,
} from "@/lib/api/user";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <div className="mx-auto max-w-lg px-4 pt-32 text-center">
        <h1 className="font-display text-2xl font-bold">Collections</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Sign in to create custom collections.
        </p>
        <Link href="/login" className="mt-4 inline-block">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Collections</h1>
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createMut.mutate();
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection name"
        />
        <Button type="submit" disabled={createMut.isPending}>
          Create
        </Button>
      </form>

      {isLoading && (
        <p className="mt-8 text-sm text-[var(--text-muted)]">Loading…</p>
      )}

      <ul className="mt-8 space-y-3">
        {(data?.items ?? []).map((c) => (
          <li key={c.id}>
            <Link
              href={`/collections/${c.id}`}
              className="block surface-card p-4 transition hover:border-[var(--primary)]/40"
            >
              <p className="font-display font-semibold">{c.name}</p>
              <p className="text-sm text-[var(--text-muted)]">
                {c.itemCount} items · {c.isPublic ? "Public" : "Private"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
