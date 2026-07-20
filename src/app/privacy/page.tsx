import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6 space-y-4 text-[var(--text-secondary)]">
      <h1 className="font-display text-3xl font-bold text-[var(--text-primary)]">
        Privacy Policy
      </h1>
      <p>
        CineVerse collects account data (email, display name), library activity,
        and optional analytics to improve recommendations. We do not sell personal
        data.
      </p>
      <p>
        Authentication is handled by Firebase Auth. Catalog metadata may be cached
        from TMDB, AniList, and TVMaze under their respective terms.
      </p>
      <p>
        You may request account deletion from Settings. Rights documents and admin
        assets are never public.
      </p>
    </div>
  );
}
