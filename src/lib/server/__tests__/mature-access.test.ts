import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const resolveAuth = vi.fn();
vi.mock("@/lib/server/auth", () => ({
  resolveAuth: (...args: unknown[]) => resolveAuth(...args),
}));

const { canIncludeMature } = await import("@/lib/server/mature-access");

const req = () => new NextRequest("https://cineverse.app/api/v1/movies");

describe("canIncludeMature", () => {
  beforeEach(() => resolveAuth.mockReset());

  it("grants the allowlisted, verified account", async () => {
    resolveAuth.mockResolvedValue({
      uid: "u1",
      email: "cmark7781@gmail.com",
      isAdmin: false,
      token: "t",
    });
    await expect(canIncludeMature(req())).resolves.toBe(true);
  });

  it("denies any other authenticated account", async () => {
    resolveAuth.mockResolvedValue({
      uid: "u2",
      email: "other@gmail.com",
      isAdmin: false,
      token: "t",
    });
    await expect(canIncludeMature(req())).resolves.toBe(false);
  });

  it("denies anonymous callers (no resolved email)", async () => {
    resolveAuth.mockResolvedValue({
      uid: null,
      email: null,
      isAdmin: false,
      token: null,
    });
    await expect(canIncludeMature(req())).resolves.toBe(false);
  });

  it("only trusts the token-resolved email (resolves auth from the request)", async () => {
    resolveAuth.mockResolvedValue({
      uid: null,
      email: null,
      isAdmin: false,
      token: null,
    });
    const spoofed = new NextRequest(
      "https://cineverse.app/api/v1/movies?email=cmark7781@gmail.com&mature=1",
      { headers: { "x-email": "cmark7781@gmail.com", "x-mature": "1" } },
    );
    await expect(canIncludeMature(spoofed)).resolves.toBe(false);
    expect(resolveAuth).toHaveBeenCalledWith(spoofed);
  });
});
