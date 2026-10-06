const fs = require('fs');
const path = 'src/lib/content/catalog-service.ts';
let s = fs.readFileSync(path, 'utf8');
for (const name of ['fetchAllAnimeLive','fetchTmdbDrama','fetchTmdbMovies','fetchTmdbSeries','fetchTmdbMoviesByCountry','fetchTmdbSeriesByCountry','fetchTmdbKdrama']) s = s.replace(`  ${name},\n`, '');
s = s.replace('    const providers = Promise.all([', `    // Home needs a small fresh snapshot. Full browsing stays paginated on demand.
    const snapshot = async (requests: Promise<{ items: Content[] }>[]) =>
      (await Promise.all(requests.map((p) => p.catch(() => ({ items: [] as Content[] }))))).flatMap((p) => p.items);
    const dramaSnapshot = (type: "kdrama" | "cdrama" | "jdrama" | "thaidrama") => snapshot([
      fetchWorldDramaPage(type, 1, 20, "popularity", false),
      fetchWorldDramaPage(type, 1, 20, "newest", false),
    ]);
    const providers = Promise.all([`);
s = s.replace('fetchAllAnimeLive(includeMature).catch(() => [] as Content[])', `Promise.all([
        fetchAnilistAnime({ perPage: 30, sort: "TRENDING_DESC", isAdult: false }),
        fetchAnilistAnime({ perPage: 30, sort: "START_DATE_DESC", status: "RELEASING", isAdult: false }),
        fetchAnilistAnime({ perPage: 20, sort: "START_DATE_DESC", status: "FINISHED", isAdult: false }),
        fetchAnilistAnime({ perPage: 20, sort: "POPULARITY_DESC", format: "MOVIE", isAdult: false }),
      ]).then((lists) => lists.flat()).catch(() => [] as Content[])`);
s = s.replace('fetchTvMazePopular().catch(() => [] as Content[])', '(hasTmdbAccess() ? Promise.resolve([] as Content[]) : fetchTvMazePopular()).catch(() => [] as Content[])');
s = s.replace('fetchTvMazeKdrama().catch(() => [] as Content[])', '(hasTmdbAccess() ? Promise.resolve([] as Content[]) : fetchTvMazeKdrama()).catch(() => [] as Content[])');
for (const type of ['cdrama','jdrama','thaidrama']) s = s.replace(`fetchTmdbDrama("${type}", includeMature)`, `dramaSnapshot("${type}")`);
s = s.replace('fetchTmdbMovies()', 'snapshot([fetchWorldMoviesPage(1, 40, "popularity"), fetchWorldMoviesPage(1, 40, "newest")])');
s = s.replace('fetchTmdbSeries()', 'snapshot([fetchWorldSeriesPage(1, 40, "popularity"), fetchWorldSeriesPage(1, 40, "newest")])');
s = s.replace('fetchTmdbKdrama()', 'dramaSnapshot("kdrama")');
s = s.replace('fetchTmdbMoviesByCountry(cc, includeMature)', 'snapshot([fetchWorldMoviesPage(1, 20, "popularity", false, cc)])');
s = s.replace('fetchTmdbSeriesByCountry(cc)', 'snapshot([fetchWorldSeriesPage(1, 20, "popularity", cc)])');
// Trailer lookup already happens on demand in the hero. Do not stall the whole catalog for it.
s = s.replace(/    \/\/ Trailer enrichment is best-effort[\s\S]*?\n    \/\/ Keep the balanced order/, '    // Keep the balanced order');
s = s.replace('let featuredUnique =', 'const featuredUnique =');
s = s.replace('      (await this.loadLive(includeMature)).map', '      (await this.loadLive(false)).map');
// Do not reset the age of a stale snapshot every time a provider fails.
s = s.replace(/        \/\/ Refresh cache timestamp[\s\S]*?        void providers/, '        void providers');
s = s.replace('      featuredUpdatedAt: generatedAt,', '      catalogStatus: raw.some((c) => !SEED_CONTENT.some((seed) => seed.id === c.id)) ? "live" : "fallback",\n      featuredUpdatedAt: new Date(this.liveCache?.at ?? Date.now()).toISOString(),');
fs.writeFileSync(path, s);
