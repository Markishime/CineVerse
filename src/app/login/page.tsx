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
import { Eye, EyeOff, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { getClientAuth, isFirebaseConfigured } from "@/lib/firebase/client";

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
      setError("Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.");
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
    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured.");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(getClientAuth(), provider);
      goNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
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

  return (
    <AuthShell
      side="login"
      badge="Free · Unlimited"
      title="Welcome back"
      subtitle="Sign in to stream movies, series, anime, and K-drama — track progress and pick up where you left off."
      footer={
        <>
          <Link
            href="/forgot-password"
            className="text-[var(--primary-light)] hover:underline"
          >
            Forgot password
          </Link>
          {" · "}
          New here?{" "}
          <Link href="/signup" className="text-[var(--primary-light)] hover:underline">
            Create free account
          </Link>
        </>
      }
    >
      <Button
        type="button"
        variant="secondary"
        className="w-full gap-2 py-6 text-base"
        onClick={google}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <div className="h-px flex-1 bg-white/10" />
        or email
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            Email
          </label>
          <Input
            type="email"
            placeholder="you@email.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-[var(--danger)]">
              {errors.email.message}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            Password
          </label>
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              placeholder="Your password"
              autoComplete="current-password"
              className="pr-11"
              {...register("password")}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-[var(--danger)]">
              {errors.password.message}
            </p>
          )}
        </div>
        {error && (
          <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-xl border border-[var(--success)]/40 bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]">
            {info}
          </div>
        )}
        <Button
          type="submit"
          className="w-full py-6 text-base"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full gap-2"
        onClick={emailLink}
      >
        <Mail className="h-4 w-4" />
        Email me a sign-in link
      </Button>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center">
          <div className="h-72 w-full max-w-md skeleton rounded-3xl" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
