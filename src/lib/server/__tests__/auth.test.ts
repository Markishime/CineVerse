import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/server/auth";

describe("resolveAuth token trust", () => {
  it("returns no identity when no bearer token is present", async () => {
    const auth = await resolveAuth(
      new NextRequest("https://cineverse.app/api/v1/movies"),
    );
    expect(auth.uid).toBeNull();
    expect(auth.email).toBeNull();
  });

  it("ignores spoofed query/header emails without a bearer token", async () => {
    const auth = await resolveAuth(
      new NextRequest(
        "https://cineverse.app/api/v1/movies?email=cmark7781@gmail.com&mature=1",
        { headers: { "x-email": "cmark7781@gmail.com", "x-mature": "1" } },
      ),
    );
    expect(auth.email).toBeNull();
  });

  it("never maps a demo token onto the allowlisted gmail", async () => {
    const auth = await resolveAuth(
      new NextRequest("https://cineverse.app/api/v1/movies", {
        headers: { authorization: "Bearer demo:cmark7781" },
      }),
    );
    expect(auth.email).toBe("cmark7781@demo.cineverse.app");
  });
});
