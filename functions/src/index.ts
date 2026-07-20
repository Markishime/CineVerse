import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { TmdbAdapter } from "./providers/tmdb";
import { AnilistAdapter } from "./providers/anilist";
import { withSyncLock } from "./sync/locks";
import { isKDrama, isValidAnime } from "./lib/classification";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 20 });

const tmdbToken = defineSecret("TMDB_ACCESS_TOKEN");

const db = getFirestore();

async function verifyBearer(
  req: { headers: { authorization?: string } },
): Promise<{ uid: string; admin: boolean } | null> {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, admin: Boolean(decoded.admin) };
  } catch {
    return null;
  }
}

function cors(res: {
  set: (k: string, v: string) => void;
  status: (n: number) => { json: (b: unknown) => void };
}) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
}

/**
 * HTTP API entry — production gateway for provider-backed catalog.
 * Secrets stay server-side; frontend never calls TMDB/AniList directly.
 */
export const api = onRequest(
  { secrets: [tmdbToken], timeoutSeconds: 60, memory: "512MiB" },
  async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const path = (req.path || "/").replace(/^\/api\/v1/, "") || "/";
    const auth = await verifyBearer(req);

    try {
      if (req.method === "GET" && path === "/health") {
        res.json({ ok: true, service: "cineverse-functions" });
        return;
      }

      if (req.method === "GET" && path === "/search") {
        const q = String(req.query.q ?? "");
        const tmdb = new TmdbAdapter(tmdbToken.value());
        const anilist = new AnilistAdapter();
        const [movies, tv, anime] = await Promise.all([
          tmdb.searchMovies(q),
          tmdb.searchTv(q),
          anilist.search(q),
        ]);
        res.json({ items: [...movies, ...tv, ...anime], page: 1, totalPages: 1 });
        return;
      }

      if (req.method === "GET" && path === "/admin/dashboard") {
        if (!auth?.admin) {
          res.status(403).json({ error: "Admin access required" });
          return;
        }
        const snap = await db.collection("content").count().get();
        res.json({
          contentTotals: { all: snap.data().count },
          providerStatus: [
            { name: "TMDB", status: tmdbToken.value() ? "ok" : "missing" },
            { name: "AniList", status: "ok" },
          ],
        });
        return;
      }

      if (req.method === "POST" && path.startsWith("/admin/sync/")) {
        if (!auth?.admin) {
          res.status(403).json({ error: "Admin access required" });
          return;
        }
        const jobType = path.split("/").pop()!;
        res.json({ ok: true, jobType, status: "queued" });
        return;
      }

      res.status(404).json({ error: "Not found", path });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        error: e instanceof Error ? e.message : "Internal error",
      });
    }
  },
);

/** Every 30 minutes — trending & airing */
export const syncEvery30m = onSchedule(
  {
    schedule: "every 30 minutes",
    secrets: [tmdbToken],
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async () => {
    await withSyncLock(db, "sync_30m", 25 * 60 * 1000, async () => {
      const tmdb = new TmdbAdapter(tmdbToken.value());
      const anilist = new AnilistAdapter();
      const [trendingMovies, trendingTv, airingAnime] = await Promise.all([
        tmdb.trendingMovies(),
        tmdb.trendingTv(),
        anilist.currentlyAiring(),
      ]);

      const batch = db.batch();
      let n = 0;
      for (const item of [
        ...trendingMovies,
        ...trendingTv,
        ...airingAnime,
      ].slice(0, 80)) {
        const ref = db.collection("content").doc(item.id);
        batch.set(ref, { ...item, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        n++;
      }
      if (n) await batch.commit();
      await db.collection("syncJobs").add({
        type: "sync_30m",
        status: "success",
        count: n,
        at: FieldValue.serverTimestamp(),
      });
    });
  },
);

/** Every 3 hours — popular & providers */
export const syncEvery3h = onSchedule(
  {
    schedule: "every 3 hours",
    secrets: [tmdbToken],
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    await withSyncLock(db, "sync_3h", 2.5 * 60 * 60 * 1000, async () => {
      const tmdb = new TmdbAdapter(tmdbToken.value());
      const popular = await tmdb.popularMovies();
      const batch = db.batch();
      popular.slice(0, 40).forEach((item) => {
        batch.set(
          db.collection("content").doc(item.id),
          { ...item, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
      });
      await batch.commit();
    });
  },
);

/** Every 12 hours — upcoming & homepage */
export const syncEvery12h = onSchedule(
  {
    schedule: "every 12 hours",
    secrets: [tmdbToken],
    timeoutSeconds: 540,
  },
  async () => {
    await withSyncLock(db, "sync_12h", 11 * 60 * 60 * 1000, async () => {
      const tmdb = new TmdbAdapter(tmdbToken.value());
      const upcoming = await tmdb.upcomingMovies();
      const batch = db.batch();
      upcoming.slice(0, 40).forEach((item) => {
        batch.set(
          db.collection("content").doc(item.id),
          { ...item, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
      });
      await batch.commit();
      await db.collection("homepageCollections").doc("default").set(
        {
          updatedAt: FieldValue.serverTimestamp(),
          source: "scheduled_12h",
        },
        { merge: true },
      );
    });
  },
);

/** Daily maintenance */
export const syncDaily = onSchedule(
  {
    schedule: "every day 04:00",
    timeoutSeconds: 540,
  },
  async () => {
    await withSyncLock(db, "sync_daily", 20 * 60 * 60 * 1000, async () => {
      // Clean expired search cache
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const stale = await db
        .collection("searchCache")
        .where("expiresAt", "<", new Date(cutoff).toISOString())
        .limit(200)
        .get()
        .catch(() => null);
      if (stale && !stale.empty) {
        const batch = db.batch();
        stale.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await db.collection("syncJobs").add({
        type: "daily_maintenance",
        status: "success",
        at: FieldValue.serverTimestamp(),
      });
    });
  },
);

// Re-export classification helpers for tests
export { isKDrama, isValidAnime };
