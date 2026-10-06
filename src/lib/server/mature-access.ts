import type { NextRequest } from "next/server";

/** 18+ content is removed: no request may include adult metadata. */
export async function canIncludeMature(request: NextRequest): Promise<boolean> {
  void request;
  return false;
}
