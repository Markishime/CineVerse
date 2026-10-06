import Link from "next/link";

/** Shown instead of a player when a direct link points at removed 18+ content. */
export function UnavailableTitle() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl font-bold text-white">
        This title isn&apos;t available
      </h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        CineVerse doesn&apos;t include 18+ content.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-semibold"
        style={{ color: "#000" }}
      >
        Back home
      </Link>
    </div>
  );
}
