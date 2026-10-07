"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.9 2.3 2.8 6.4 2.8 11.5S6.9 20.7 12 20.7c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
      />
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const google = async () => {
    setError(null);
    setGoogleLoading(true);
    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured.");
      setGoogleLoading(false);
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(getClientAuth(), provider);
      goNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
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

  const busy = isSubmitting || googleLoading;

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
      <Button
        type="button"
        variant="secondary"
        className="h-12 w-full gap-2.5 border-white/12 bg-white/[0.06] text-[15px] shadow-none transition-all duration-200 hover:scale-[1.01] hover:border-white/20 hover:bg-white/[0.09] active:scale-[0.99]"
        onClick={google}
        disabled={busy}
      >
        {googleLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <GoogleIcon className="h-5 w-5 shrink-0" />
        )}
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/14 to-transparent" />
        or email
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/14 to-transparent" />
      </div>

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
