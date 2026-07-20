"use client";

import Link from "next/link";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { getClientAuth, isFirebaseConfigured } from "@/lib/firebase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <AuthShell
      side="forgot"
      badge="Account recovery"
      title="Reset password"
      subtitle="Enter the email for your free CineVerse account. Google accounts should use Continue with Google on the sign-in page instead."
      footer={
        <>
          <Link href="/login" className="text-[var(--primary-light)] hover:underline">
            Back to sign in
          </Link>
          {" · "}
          <Link href="/signup" className="text-[var(--primary-light)] hover:underline">
            Create free account
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setMessage(null);
          setPending(true);
          if (!isFirebaseConfigured()) {
            setError("Firebase is not configured.");
            setPending(false);
            return;
          }
          try {
            await sendPasswordResetEmail(getClientAuth(), email);
            setMessage("If an account exists, a reset email is on its way.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Request failed");
          } finally {
            setPending(false);
          }
        }}
      >
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            Email
          </label>
          <Input
            type="email"
            required
            placeholder="you@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error && (
          <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-xl border border-[var(--success)]/40 bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]">
            {message}
          </div>
        )}
        <Button type="submit" className="w-full py-6 text-base" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
