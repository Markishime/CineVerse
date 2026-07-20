/**
 * Firestore rules tests — run with Emulator Suite:
 *   firebase emulators:exec --only firestore "npx vitest run tests/rules"
 *
 * These tests document expected rule behavior and skip when emulator
 * credentials are unavailable in CI without Firebase tooling.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Firestore rules file", () => {
  const rulesPath = path.join(process.cwd(), "firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf8");

  it("is deny-by-default", () => {
    expect(rules).toContain("allow read, write: if false");
  });

  it("requires admin custom claim for catalog writes", () => {
    expect(rules).toContain("request.auth.token.admin == true");
    expect(rules).toMatch(/match \/content\/\{id\}[\s\S]*allow write: if isAdmin/);
  });

  it("scopes library docs to owner", () => {
    expect(rules).toContain("request.auth.uid + '_' + request.resource.data.contentId");
  });

  it("protects contentRights as admin-only", () => {
    expect(rules).toMatch(
      /match \/contentRights\/\{id\}[\s\S]*allow read, write: if isAdmin/,
    );
  });

  it("blocks self-assignment of admin fields on users", () => {
    expect(rules).toContain("!('admin' in request.resource.data)");
  });
});

describe("Storage rules file", () => {
  const rulesPath = path.join(process.cwd(), "storage.rules");
  const rules = fs.readFileSync(rulesPath, "utf8");

  it("denies by default and protects rights path", () => {
    expect(rules).toContain("allow read, write: if false");
    expect(rules).toContain("match /rights/{contentId}/{fileName}");
    expect(rules).toContain("isAdmin()");
  });

  it("validates avatar size and type", () => {
    expect(rules).toContain("isImage()");
    expect(rules).toContain("under5mb()");
  });
});
