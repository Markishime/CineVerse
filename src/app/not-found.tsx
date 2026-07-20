import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--primary-light)]">
        404
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold">Lost in the nebula</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        That page drifted out of orbit.
      </p>
      <Link href="/" className="mt-6">
        <Button>Return home</Button>
      </Link>
    </div>
  );
}
