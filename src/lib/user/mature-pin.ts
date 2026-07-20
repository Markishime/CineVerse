/**
 * Parental PIN for 18+ mature content.
 * PIN hash is device-local (never sent to the server as plaintext).
 * Session unlock lives in sessionStorage so kids can't re-open 18+ after a parent leaves.
 */

const PIN_HASH_PREFIX = "cineverse_mature_pin_hash_";
const SESSION_UNLOCK_KEY = "cineverse_mature_pin_session";

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

function pinHashKey(uid: string) {
  return `${PIN_HASH_PREFIX}${uid}`;
}

/** Sync hash for local verification (PIN is short; not a password vault). */
function hashPinSync(pin: string, uid: string): string {
  const input = `cineverse-parental:${uid}:${pin}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Second mix so short PINs aren't trivially reverse-mapped
  let h2 = 0x811c9dc5;
  const reversed = input.split("").reverse().join("");
  for (let i = 0; i < reversed.length; i++) {
    h2 ^= reversed.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193);
  }
  return `${(h >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

export function hasParentalPin(uid?: string | null): boolean {
  if (typeof window === "undefined" || !uid) return false;
  try {
    return Boolean(window.localStorage.getItem(pinHashKey(uid)));
  } catch {
    return false;
  }
}

export function setParentalPin(uid: string, pin: string): void {
  if (!isValidPinFormat(pin)) {
    throw new Error("PIN must be 4–6 digits");
  }
  window.localStorage.setItem(pinHashKey(uid), hashPinSync(pin, uid));
}

export function verifyParentalPin(uid: string, pin: string): boolean {
  if (!isValidPinFormat(pin)) return false;
  try {
    const stored = window.localStorage.getItem(pinHashKey(uid));
    if (!stored) return false;
    return stored === hashPinSync(pin, uid);
  } catch {
    return false;
  }
}

export function clearParentalPin(uid: string): void {
  try {
    window.localStorage.removeItem(pinHashKey(uid));
  } catch {
    /* ignore */
  }
  clearMatureSessionUnlock();
}

/** True after correct PIN this browser tab/session. */
export function isMatureSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMatureSessionUnlocked(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.sessionStorage.setItem(SESSION_UNLOCK_KEY, "1");
    else window.sessionStorage.removeItem(SESSION_UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

export function clearMatureSessionUnlock(): void {
  setMatureSessionUnlocked(false);
}
