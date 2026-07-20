import type { Metadata } from "next";

export const metadata: Metadata = { title: "Maintenance" };

export default function MaintenancePage() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl font-bold">Under maintenance</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        CineVerse is realigning the celestial index. Please check back soon.
      </p>
    </div>
  );
}
