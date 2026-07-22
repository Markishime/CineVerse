import type { Metadata } from "next";

export const metadata: Metadata = { title: "Maintenance" };

export default function MaintenancePage() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
        Status
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
        Under maintenance
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        CineVerse is realigning the celestial index. Please check back soon.
      </p>
    </div>
  );
}
