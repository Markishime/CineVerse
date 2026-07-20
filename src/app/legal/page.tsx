import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Legal" };

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Legal</h1>
      <ul className="mt-6 space-y-3 text-[var(--primary-light)]">
        <li>
          <Link href="/privacy">Privacy Policy</Link>
        </li>
        <li>
          <Link href="/terms">Terms of Service</Link>
        </li>
        <li>
          <Link href="/copyright">Copyright &amp; DMCA</Link>
        </li>
      </ul>
    </div>
  );
}
