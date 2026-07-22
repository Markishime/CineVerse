import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]">
        CineVerse
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
        About
      </h1>
      <div className="mt-6 space-y-4 text-[var(--text-secondary)] leading-relaxed">
        <p>
          CineVerse is a premium entertainment discovery and tracking platform for
          movies, TV series, anime, and Korean dramas. Find what to watch, track
          progress, and stream when rights allow.
        </p>
        <p>
          CineVerse does not host content directly. Streaming is powered by
          third-party embed providers that index publicly available sources.
        </p>
        <p>
          Design system:{" "}
          <strong className="text-white">Celestial Noir</strong> — cinematic and
          elegant without copying existing streamers.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/discover">
          <Button>Discover</Button>
        </Link>
        <Link href="/legal">
          <Button variant="secondary">Legal</Button>
        </Link>
      </div>
    </div>
  );
}
