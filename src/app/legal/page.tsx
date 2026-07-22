import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Legal" };

const LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/copyright", label: "Copyright & DMCA" },
] as const;

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]">
        Policies
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
        Legal
      </h1>
      <ul className="mt-8 space-y-2">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block rounded-xl border border-white/10 bg-[var(--surface)] px-4 py-3.5 text-[var(--primary-light)] transition-colors hover:border-white/18 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
