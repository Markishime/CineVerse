import { loadEnvConfig } from "@next/env";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  anidbCacheDir,
  fetchAnidbById,
  fetchAnidbTitleIndex,
  isAnidbConfigured,
  isAnidbCatalogComplete,
  readAnidbCatalog,
  saveAnidbCatalog,
} from "../src/lib/providers/anidb-client";
import type { AnidbRecord } from "../src/lib/providers/anidb-client";

loadEnvConfig(process.cwd());

async function main() {
  if (!isAnidbConfigured())
    throw new Error(
      "Set ANIDB_CLIENT and ANIDB_CLIENT_VERSION to your registered AniDB HTTP client before importing.",
    );
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const ids = args
    .find((a) => a.startsWith("--ids="))
    ?.slice(6)
    .split(",")
    .map(Number);
  if (!all && !ids?.length)
    throw new Error(
      "Use --all for every anime, or --ids=23,69 for specific AniDB IDs.",
    );
  if (ids?.some((id) => !Number.isSafeInteger(id) || id < 1))
    throw new Error("AniDB IDs must be positive integers.");
  const index = all ? await fetchAnidbTitleIndex() : [];
  const targets = [...new Set(all ? index.map((a) => a.aid) : ids!)];
  const catalog = new Map(
    (await readAnidbCatalog()).map((c) => [c.providerIds.anidb!, c]),
  );
  const wasComplete = await isAnidbCatalogComplete();
  // Resume after interruption, including records saved since the last checkpoint.
  for (const name of await readdir(anidbCacheDir()).catch(
    () => [] as string[],
  )) {
    if (!/^\d+\.json$/.test(name)) continue;
    const record = JSON.parse(
      await readFile(join(anidbCacheDir(), name), "utf8"),
    ) as AnidbRecord;
    catalog.set(record.content.providerIds.anidb!, record.content);
  }
  let completed = 0;
  try {
    for (const aid of targets) {
      // Finish an interrupted initial catalog before refreshing its older rows.
      if (!wasComplete && catalog.has(aid)) {
        completed++;
        continue;
      }
      const record = await fetchAnidbById(aid);
      if (!record)
        throw new Error(
          `AniDB ${aid} unavailable or another sync is active. Retry later to resume.`,
        );
      catalog.set(aid, record.content);
      completed++;
      if (completed % 25 === 0) {
        await saveAnidbCatalog([...catalog.values()], wasComplete);
        console.log(`AniDB: ${completed}/${targets.length}`);
      }
    }
  } catch (error) {
    await saveAnidbCatalog([...catalog.values()], wasComplete);
    throw error;
  }
  await saveAnidbCatalog([...catalog.values()], wasComplete || all);
  console.log(
    `Imported ${completed} anime into ${anidbCacheDir()}. ${all ? "AniDB now supplies the complete browse catalog." : "Metadata is available for matching browse and detail titles; run --all to switch the complete catalog."}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
