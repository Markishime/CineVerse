"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Suspense, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { getClientAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type Form = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const goNext = () => {
    router.push(next.startsWith("/") ? next : "/");
  };

  const onSubmit = async (data: Form) => {
    setError(null);
    if (!isFirebaseConfigured()) {
      setError(
        "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.",
      );
      return;
    }
    try {
      await signInWithEmailAndPassword(
        getClientAuth(),
        data.email,
        data.password,
      );
      goNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  const emailLink = async () => {
    setError(null);
    setInfo(null);
    const email = getValues("email");
    if (!email) {
      setError("Enter your email first");
      return;
    }
    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured.");
      return;
    }
    try {
      await sendSignInLinkToEmail(getClientAuth(), email, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem("cineverseEmailForSignIn", email);
      setInfo("Check your email for a magic sign-in link.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send link");
    }
  };

  const busy = isSubmitting;

  return (
    <AuthShell
      side="login"
      badge="Free · Unlimited"
      title="Welcome back"
      subtitle="Sign in to track progress, build your list, and pick up where you left off."
      footer={
        <>
          <Link
            href="/forgot-password"
            className="text-[var(--primary-light)] underline-offset-2 transition-colors hover:text-white hover:underline"
          >
            Forgot password
          </Link>
          <span className="mx-1.5 text-white/20">·</span>
          New here?{" "}
          <Link
            href="/signup"
            className="font-medium text-[var(--primary-light)] underline-offset-2 transition-colors hover:text-white hover:underline"
          >
            Create free account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              id="login-email"
              type="email"
              placeholder="you@email.com"
              autoComplete="email"
              inputMode="email"
              aria-invalid={Boolean(errors.email)}
              className={cn(
                "h-12 bg-black/25 pl-10 transition-[border-color,box-shadow] duration-200",
                errors.email &&
                  "border-[var(--danger)]/60 focus-visible:ring-[var(--danger)]/40",
              )}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-xs text-[var(--danger)]" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--primary-light)] lg:hidden"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              id="login-password"
              type={showPw ? "text" : "password"}
              placeholder="Your password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              className={cn(
                "h-12 bg-black/25 pl-10 pr-12 transition-[border-color,box-shadow] duration-200",
                errors.password &&
                  "border-[var(--danger)]/60 focus-visible:ring-[var(--danger)]/40",
              )}
              {...register("password")}
            />
            <button
              type="button"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs text-[var(--danger)]" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        {error && (
          <div
            className="rounded-xl border border-[var(--danger)]/35 bg-[var(--danger)]/10 px-3.5 py-2.5 text-sm text-[var(--danger)]"
            role="alert"
          >
            {error}
          </div>
        )}
        {info && (
          <div
            className="rounded-xl border border-[var(--success)]/35 bg-[var(--success)]/10 px-3.5 py-2.5 text-sm text-[var(--success)]"
            role="status"
          >
            {info}
          </div>
        )}

        <Button
          type="submit"
          className="h-12 w-full text-[15px] font-semibold transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
          disabled={busy}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <Button
        type="button"
        variant="outline"
        className="mt-3 h-11 w-full gap-2 border-dashed text-sm transition-all duration-200 hover:scale-[1.01] hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5 active:scale-[0.99]"
        onClick={emailLink}
        disabled={busy}
      >
        <Mail className="h-4 w-4" />
        Email me a sign-in link
      </Button>

      <p className="mt-5 text-center text-[11px] text-[var(--text-muted)]">
        Free unlimited membership · No credit card
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)] px-4">
          <div className="h-96 w-full max-w-md skeleton rounded-[1.75rem]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
