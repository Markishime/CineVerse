"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { isRestrictedContentUser } from "@/lib/content/mature";
import { CatalogPage } from "@/components/content/catalog-page";
import { Button } from "@/components/ui/button";

export default function FilipinoMoviesPage() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
        <div className="mx-auto h-10 w-10 skeleton rounded-full" />
        <p className="mt-4 text-sm text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (!isRestrictedContentUser(user?.email)) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--danger)]" />
        <h1 className="mt-4 font-display text-3xl font-bold text-white">
          Access restricted
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          You do not have permission to view this content.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CatalogPage
      type="movie"
      country="PH"
      title="Filipino Movies"
      subtitle="Explore Filipino cinema — drama, comedy, and indie films"
    />
  );
}
