"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { getClientAuth, isFirebaseConfigured } from "@/lib/firebase/client";

const schema = z
  .object({
    displayName: z.string().min(2, "Name must be at least 2 characters").max(40),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
    ageConfirm: z.boolean().optional(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords must match",
    path: ["confirm"],
  });

type Form = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { ageConfirm: false },
  });

  const onSubmit = async (data: Form) => {
    setError(null);
    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.");
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(
        getClientAuth(),
        data.email,
        data.password,
      );
      await updateProfile(cred.user, { displayName: data.displayName });
      await sendEmailVerification(cred.user);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed");
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
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-up failed");
    }
  };

  return (
    <AuthShell
      side="signup"
      badge="Free forever"
      title="Join CineVerse"
      subtitle="Create your free unlimited account for movies, series, anime, and K-drama."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--primary-light)] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Button
        type="button"
        variant="secondary"
        className="h-12 w-full gap-2 text-[15px] transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
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
        Sign up with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/12" />
        or email
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/12" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label
            htmlFor="signup-name"
            className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
          >
            Display name
          </label>
          <Input
            id="signup-name"
            className="h-12"
            placeholder="How should we call you?"
            {...register("displayName")}
          />
          {errors.displayName && (
            <p className="mt-1.5 text-xs text-[var(--danger)]" role="alert">
              {errors.displayName.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="signup-email"
            className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
          >
            Email
          </label>
          <Input
            id="signup-email"
            type="email"
            className="h-12"
            placeholder="you@email.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1.5 text-xs text-[var(--danger)]" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="signup-password"
            className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
          >
            Password
          </label>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPw ? "text" : "password"}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="h-12 pr-12"
              {...register("password")}
            />
            <button
              type="button"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs text-[var(--danger)]" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="signup-confirm"
            className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
          >
            Confirm password
          </label>
          <Input
            id="signup-confirm"
            type={showPw ? "text" : "password"}
            className="h-12"
            placeholder="Repeat password"
            autoComplete="new-password"
            {...register("confirm")}
          />
          {errors.confirm && (
            <p className="mt-1.5 text-xs text-[var(--danger)]" role="alert">
              {errors.confirm.message}
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
        <Button
          type="submit"
          className="h-12 w-full text-[15px] transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account…" : "Create free account"}
        </Button>
      </form>
    </AuthShell>
  );
}
