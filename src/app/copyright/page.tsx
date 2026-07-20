import type { Metadata } from "next";

export const metadata: Metadata = { title: "Copyright" };

export default function CopyrightPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6 space-y-4 text-[var(--text-secondary)]">
      <h1 className="font-display text-3xl font-bold text-[var(--text-primary)]">
        Copyright &amp; DMCA
      </h1>
      <p>
        CineVerse respects intellectual property. We do not host unauthorized
        movies, episodes, or subtitles. Trailers use official authorized sources
        only (e.g. YouTube official channels via provider metadata).
      </p>
      <p>
        Full playback requires verified rights records: active license, permitted
        region, and admin-approved assets.
      </p>
      <p>
        Rights holders may contact the operators for takedown of unauthorized
        user-generated content (reviews, avatars, collection covers).
      </p>
    </div>
  );
}
