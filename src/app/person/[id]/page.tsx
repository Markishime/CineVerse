"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6">
      <Link
        href="/"
        className="text-sm text-[var(--primary-light)] underline-offset-2 hover:underline"
      >
        ← Home
      </Link>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]">
        Cast & crew
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
        Person
      </h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">ID: {id}</p>
      <p className="mt-4 max-w-prose text-sm leading-relaxed text-[var(--text-secondary)]">
        Cast and crew profiles and filmography are updated regularly.
      </p>
      <Link href="/discover" className="mt-8 inline-block">
        <Button variant="secondary">Discover titles</Button>
      </Link>
    </div>
  );
}
