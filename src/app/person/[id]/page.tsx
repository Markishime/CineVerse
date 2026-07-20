"use client";

import { use } from "react";
import Link from "next/link";

export default function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6">
      <Link href="/" className="text-sm text-[var(--primary-light)]">
        ← Home
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold">Person</h1>
      <p className="mt-2 text-[var(--text-muted)]">ID: {id}</p>
      <p className="mt-4 text-sm text-[var(--text-secondary)]">
        Cast and crew profiles are populated from TMDB/AniList via Cloud
        Functions. Filmography loads when provider sync is configured.
      </p>
    </div>
  );
}
