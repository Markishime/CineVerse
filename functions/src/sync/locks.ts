import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Prevents duplicate scheduled sync jobs using Firestore lock documents.
 */
export async function withSyncLock(
  db: Firestore,
  lockId: string,
  ttlMs: number,
  fn: () => Promise<void>,
): Promise<boolean> {
  const ref = db.collection("syncLocks").doc(lockId);
  const now = Date.now();

  const acquired = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const data = snap.data() as { lockedUntil?: number };
      if (data.lockedUntil && data.lockedUntil > now) {
        return false;
      }
    }
    tx.set(
      ref,
      {
        lockedUntil: now + ttlMs,
        lockedAt: FieldValue.serverTimestamp(),
        owner: process.env.K_REVISION ?? "local",
      },
      { merge: true },
    );
    return true;
  });

  if (!acquired) {
    console.log(`Lock ${lockId} held; skipping`);
    return false;
  }

  try {
    await fn();
    return true;
  } finally {
    await ref.set(
      { lockedUntil: 0, releasedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
}
