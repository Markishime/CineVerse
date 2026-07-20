import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6 space-y-4 text-[var(--text-secondary)]">
      <h1 className="font-display text-3xl font-bold text-[var(--text-primary)]">
        Terms of Service
      </h1>
      <p>
        CineVerse is a discovery and tracking service. You agree not to use the
        platform to distribute or access unauthorized copyrighted media.
      </p>
      <p>
        User reviews must not include illegal content. Spoiler-tagged content
        should remain hidden unless viewers opt in.
      </p>
      <p>
        We may suspend accounts that abuse APIs, scrape protected data, or
        attempt privilege escalation.
      </p>
    </div>
  );
}
