"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { getClientAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    displayName: z.string().min(2, "Name must be at least 2 characters").max(40),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords must match",
    path: ["confirm"],
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

function passwordStrength(pw: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!pw) return { score: 0, label: "", color: "bg-white/15" };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2)
    return { score, label: "Weak", color: "bg-[var(--danger)]" };
  if (score <= 3)
    return { score, label: "Okay", color: "bg-[var(--warning)]" };
  if (score <= 4)
    return { score, label: "Strong", color: "bg-[var(--secondary)]" };
  return { score, label: "Excellent", color: "bg-[var(--success)]" };
}

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirm: "",
    },
  });

  const passwordValue = useWatch({ control, name: "password", defaultValue: "" });
  const strength = useMemo(
    () => passwordStrength(passwordValue ?? ""),
    [passwordValue],
  );

  const onSubmit = async (data: Form) => {
    setError(null);
    if (!isFirebaseConfigured()) {
      setError(
        "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.",
      );
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
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-up failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const busy = isSubmitting || googleLoading;

  return (
    <AuthShell
      side="signup"
      badge="Free forever"
      title="Join CineVerse"
      subtitle="Create your free unlimited account for movies, series, anime, and K-drama."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--primary-light)] underline-offset-2 transition-colors hover:text-white hover:underline"
          >
            Sign in
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
        Sign up with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/14 to-transparent" />
        or email
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/14 to-transparent" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label
            htmlFor="signup-name"
            className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
          >
            Display name
          </label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              id="signup-name"
              className={cn(
                "h-12 bg-black/25 pl-10",
                errors.displayName &&
                  "border-[var(--danger)]/60 focus-visible:ring-[var(--danger)]/40",
              )}
              placeholder="How should we call you?"
              autoComplete="name"
              {...register("displayName")}
            />
          </div>
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
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              id="signup-email"
              type="email"
              className={cn(
                "h-12 bg-black/25 pl-10",
                errors.email &&
                  "border-[var(--danger)]/60 focus-visible:ring-[var(--danger)]/40",
              )}
              placeholder="you@email.com"
              autoComplete="email"
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
          <label
            htmlFor="signup-password"
            className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
          >
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              id="signup-password"
              type={showPw ? "text" : "password"}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className={cn(
                "h-12 bg-black/25 pl-10 pr-12",
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
          {passwordValue && passwordValue.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors duration-200",
                      i < strength.score ? strength.color : "bg-white/10",
                    )}
                  />
                ))}
              </div>
              {strength.label && (
                <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                  Strength:{" "}
                  <span className="font-medium text-[var(--text-secondary)]">
                    {strength.label}
                  </span>
                </p>
              )}
            </div>
          )}
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
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              id="signup-confirm"
              type={showPw ? "text" : "password"}
              className={cn(
                "h-12 bg-black/25 pl-10",
                errors.confirm &&
                  "border-[var(--danger)]/60 focus-visible:ring-[var(--danger)]/40",
              )}
              placeholder="Repeat password"
              autoComplete="new-password"
              {...register("confirm")}
            />
          </div>
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
          className="h-12 w-full text-[15px] font-semibold transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
          disabled={busy}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create free account"
          )}
        </Button>
      </form>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
        Free unlimited membership · No credit card · Takes under a minute
      </p>
    </AuthShell>
  );
}
