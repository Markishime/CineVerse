"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { getClientAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    displayName: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(40),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords must match",
    path: ["confirm"],
  });

type Form = z.infer<typeof schema>;

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
  if (score <= 2) return { score, label: "Weak", color: "bg-[var(--danger)]" };
  if (score <= 3) return { score, label: "Okay", color: "bg-[var(--warning)]" };
  if (score <= 4)
    return { score, label: "Strong", color: "bg-[var(--secondary)]" };
  return { score, label: "Excellent", color: "bg-[var(--success)]" };
}

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
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

  const passwordValue = useWatch({
    control,
    name: "password",
    defaultValue: "",
  });
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

  const busy = isSubmitting;

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
