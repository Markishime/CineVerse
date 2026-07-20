"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isValidPinFormat,
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
} from "@/lib/user/mature-pin";

type Mode = "verify" | "create" | "change";

/**
 * Parental PIN dialog for enabling / unlocking 18+ mature content.
 */
export function PinGateModal({
  open,
  mode = "verify",
  title,
  description,
  confirmLabel,
  onSuccess,
  onCancel,
  verifyPin,
  onCreatePin,
  onChangePin,
}: {
  open: boolean;
  mode?: Mode;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onSuccess: () => void;
  onCancel: () => void;
  /** Required for verify / change (current PIN). */
  verifyPin?: (pin: string) => boolean;
  /** Required for create. */
  onCreatePin?: (pin: string) => void;
  /** Required for change. */
  onChangePin?: (currentPin: string, nextPin: string) => boolean;
}) {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPin("");
    setPin2("");
    setCurrentPin("");
    setError(null);
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, mode]);

  if (!open) return null;

  const defaults = {
    verify: {
      title: "Enter parental PIN",
      description:
        "Enter your parental PIN to access 18+ mature content. This keeps kids from opening the mature library.",
      confirmLabel: "Unlock",
    },
    create: {
      title: "Create parental PIN",
      description:
        "Set a 4–6 digit PIN before enabling 18+ mature content. You’ll need this PIN to turn mature content on and to open the 18+ library.",
      confirmLabel: "Save PIN",
    },
    change: {
      title: "Change parental PIN",
      description: "Enter your current PIN, then choose a new 4–6 digit PIN.",
      confirmLabel: "Update PIN",
    },
  }[mode];

  const submit = () => {
    setError(null);

    if (mode === "verify") {
      if (!isValidPinFormat(pin)) {
        setError(`PIN must be ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`);
        return;
      }
      if (!verifyPin?.(pin)) {
        setError("Incorrect PIN");
        return;
      }
      onSuccess();
      return;
    }

    if (mode === "create") {
      if (!isValidPinFormat(pin)) {
        setError(`PIN must be ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`);
        return;
      }
      if (pin !== pin2) {
        setError("PINs do not match");
        return;
      }
      try {
        onCreatePin?.(pin);
        onSuccess();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save PIN");
      }
      return;
    }

    // change
    if (!isValidPinFormat(currentPin)) {
      setError("Enter your current PIN");
      return;
    }
    if (!isValidPinFormat(pin)) {
      setError(`New PIN must be ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`);
      return;
    }
    if (pin !== pin2) {
      setError("New PINs do not match");
      return;
    }
    const ok = onChangePin?.(currentPin, pin);
    if (!ok) {
      setError("Current PIN is incorrect");
      return;
    }
    onSuccess();
  };

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
        aria-labelledby="pin-gate-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[var(--surface)] shadow-2xl"
      >
        <div className="border-b border-[var(--danger)]/30 bg-[var(--danger)]/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger)]/20 text-[var(--danger)]">
              {mode === "verify" ? (
                <Lock className="h-6 w-6" />
              ) : (
                <KeyRound className="h-6 w-6" />
              )}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--danger)]">
                Parental controls
              </p>
              <h2
                id="pin-gate-title"
                className="font-display text-xl font-bold text-white"
              >
                {title ?? defaults.title}
              </h2>
            </div>
          </div>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {description ?? defaults.description}
          </p>

          {mode === "change" && (
            <label className="block text-sm text-[var(--text-secondary)]">
              Current PIN
              <Input
                ref={inputRef}
                className="mt-1 tracking-[0.35em]"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={PIN_MAX_LENGTH}
                value={currentPin}
                onChange={(e) =>
                  setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </label>
          )}

          <label className="block text-sm text-[var(--text-secondary)]">
            {mode === "change" ? "New PIN" : mode === "create" ? "PIN (4–6 digits)" : "PIN"}
            <Input
              ref={mode === "change" ? undefined : inputRef}
              className="mt-1 tracking-[0.35em]"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={PIN_MAX_LENGTH}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </label>

          {(mode === "create" || mode === "change") && (
            <label className="block text-sm text-[var(--text-secondary)]">
              Confirm PIN
              <Input
                className="mt-1 tracking-[0.35em]"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={PIN_MAX_LENGTH}
                value={pin2}
                onChange={(e) =>
                  setPin2(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </label>
          )}

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <Button className="flex-1" onClick={submit}>
              {confirmLabel ?? defaults.confirmLabel}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            PIN is stored only on this device. Don’t share it with kids who use this
            account.
          </p>
        </div>
      </div>
    </div>
  );
}
