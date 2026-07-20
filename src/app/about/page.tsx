import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6 prose-invert">
      <h1 className="font-display text-3xl font-bold">About CineVerse</h1>
      <p className="mt-4 text-[var(--text-secondary)] leading-relaxed">
        CineVerse is a premium entertainment discovery and tracking platform for
        movies, TV series, anime, and Korean dramas. We help you find what to
        watch, track progress, and stream content directly.
      </p>
      <p className="mt-4 text-[var(--text-secondary)] leading-relaxed">
        CineVerse does not host content directly. Streaming is powered by
        third-party embed providers that index publicly available sources.
      </p>
      <p className="mt-4 text-[var(--text-secondary)] leading-relaxed">
        Design system: <strong>Celestial Noir</strong> — cinematic, futuristic,
        and elegant without copying existing streamers.
      </p>
    </div>
  );
}
