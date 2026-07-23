"use client";

import Link from "next/link";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { Loader2, Mail } from "lucide-react";
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
          <Link
            href="/login"
            className="font-medium text-[var(--primary-light)] underline-offset-2 transition-colors hover:text-white hover:underline"
          >
            Back to sign in
          </Link>
          <span className="mx-1.5 text-white/20">·</span>
          <Link
            href="/signup"
            className="font-medium text-[var(--primary-light)] underline-offset-2 transition-colors hover:text-white hover:underline"
          >
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
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              type="email"
              required
              className="h-12 bg-black/25 pl-10"
              placeholder="you@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3.5 py-2.5 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-xl border border-[var(--success)]/40 bg-[var(--success)]/10 px-3.5 py-2.5 text-sm text-[var(--success)]">
            {message}
          </div>
        )}
        <Button
          type="submit"
          className="h-12 w-full text-[15px] font-semibold"
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
