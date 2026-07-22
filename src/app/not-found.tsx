import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]">
        404
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
        Lost in the nebula
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        That page drifted out of orbit. Head home or search the catalog.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/">
          <Button>Return home</Button>
        </Link>
        <Link href="/search">
          <Button variant="secondary">Search</Button>
        </Link>
      </div>
    </div>
  );
}
