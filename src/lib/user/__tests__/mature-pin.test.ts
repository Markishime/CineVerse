import { describe, expect, it, beforeEach } from "vitest";
import {
  clearParentalPin,
  hasParentalPin,
  isValidPinFormat,
  setParentalPin,
  verifyParentalPin,
} from "@/lib/user/mature-pin";

function installStorageMock() {
  const store = new Map<string, string>();
  const api: Storage = {
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  (globalThis as unknown as { window: Window }).window = {
    localStorage: api,
    sessionStorage: api,
  } as unknown as Window;
}

describe("mature-pin", () => {
  beforeEach(() => {
    installStorageMock();
  });

  it("validates pin format", () => {
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("123456")).toBe(true);
    expect(isValidPinFormat("123")).toBe(false);
    expect(isValidPinFormat("1234567")).toBe(false);
    expect(isValidPinFormat("12ab")).toBe(false);
  });

  it("sets and verifies pin", () => {
    const uid = "user-1";
    expect(hasParentalPin(uid)).toBe(false);
    setParentalPin(uid, "4829");
    expect(hasParentalPin(uid)).toBe(true);
    expect(verifyParentalPin(uid, "4829")).toBe(true);
    expect(verifyParentalPin(uid, "0000")).toBe(false);
  });

  it("clears pin", () => {
    const uid = "user-2";
    setParentalPin(uid, "9999");
    clearParentalPin(uid);
    expect(hasParentalPin(uid)).toBe(false);
    expect(verifyParentalPin(uid, "9999")).toBe(false);
  });

  it("isolates pins per user", () => {
    setParentalPin("a", "1111");
    setParentalPin("b", "2222");
    expect(verifyParentalPin("a", "1111")).toBe(true);
    expect(verifyParentalPin("a", "2222")).toBe(false);
    expect(verifyParentalPin("b", "2222")).toBe(true);
  });
});
