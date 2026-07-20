"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cineverse_age_verified_18";

export function hasAgeVerified18(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setAgeVerified18(value: boolean) {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(STORAGE_KEY, "1");
  else window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * 18+ confirmation dialog. Used before enabling mature settings or viewing 18+ titles.
 */
export function AgeGateModal({
  open,
  onConfirm,
  onCancel,
  title = "Are you 18 or older?",
  description = "Mature (18+) titles can include strong language, violence, sexual content, nudity, or other adult themes across movies, series, and anime. You must be 18+ to continue.",
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}) {
  const [checked, setChecked] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[var(--surface)] shadow-2xl"
      >
        <div className="border-b border-[var(--danger)]/30 bg-[var(--danger)]/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger)]/20 text-[var(--danger)]">
              <ShieldAlert className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--danger)]">
                18+ Mature content
              </p>
              <h2
                id="age-gate-title"
                className="font-display text-xl font-bold text-white"
              >
                {title}
              </h2>
            </div>
          </div>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-white/20"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              I confirm I am <strong className="text-white">18 years or older</strong>{" "}
              and want to view mature content on CineVerse.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1"
              disabled={!checked}
              onClick={() => {
                setAgeVerified18(true);
                onConfirm();
              }}
            >
              Enter 18+ library
            </Button>
            <Button variant="secondary" className="flex-1" onClick={onCancel}>
              I&apos;m under 18
            </Button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            You can turn mature content off anytime in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
