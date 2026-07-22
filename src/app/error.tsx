"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--danger)]">
        Error
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
        Something went wrong
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        {error.message || "Unexpected error. Try again or return home."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => (window.location.href = "/")}>
          Go home
        </Button>
      </div>
    </div>
  );
}
