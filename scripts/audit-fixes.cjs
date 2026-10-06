const fs = require('fs');
function edit(path, transform) { const old = fs.readFileSync(path, 'utf8'); const next = transform(old); if (old === next) throw Error('No edit: '+path); fs.writeFileSync(path, next); }
edit('src/lib/api/content.ts', s => s.replace('export interface HomePayload {', 'export interface HomePayload {\n  catalogStatus?: "live" | "fallback";\n  latestMovies?: Content[];\n  latestSeries?: Content[];\n  latestAnime?: Content[];\n  latestDramas?: Content[];').replace(/return Promise\.race\(\[\n    apiFetch<HomePayload>[\s\S]*?\n  \]\);/, 'return apiFetch<HomePayload>(path, { auth: false, signal: AbortSignal.timeout(14_000) });'));
edit('src/lib/content/catalog-service.ts', s => {
 s = 'import { latestReleased, latestRows } from "@/lib/content/latest";\n' + s;
 s = s.replace(/    \/\/ Country-specific MOVIE catalogs[\s\S]*?\n    \/\/ Watch Now/, '    // Watch Now');
 s = s.replace(/    \/\/ Country-origin MOVIES[\s\S]*?    const allMovies =/, '    const all = allWithRegion;\n\n    const allMovies =');
 s = s.replace(/    \/\/ General movies feeding[\s\S]*?    const movies = .*?;/, '    const movies = allMovies;');
 s = s.replace(/const (koreanMovies|japaneseMovies|chineseMovies|thaiMovies|filipinoMovies) = includeMature\s*\? (uniqueById\([^;]*?\))\s*: \[\];/g, 'const $1 = $2;');
 s = s.replace('const POPULAR_N = 48;', 'const POPULAR_N = 20;').replace('const ALL_N = 72;', 'const ALL_N = 20;');
 s = s.replace('    const year = new Date().getFullYear();\n    const generatedAt', '    const generatedAt');
 s = s.replace(/      newReleases: withPosters\([\s\S]*?\n      comingSoon:/, '      ...latestRows(all),\n      newReleases: withPosters(latestReleased(all, new Date(), 24)),\n      comingSoon:');
 return s;
});
edit('src/lib/providers/live-catalog.ts', s => {
 // Index windows must not skip titles when pageSize is not divisible by 20.
 s = s.replace('const page = Math.max(1, opts.page);\n  const pageSize = Math.min(100, Math.max(1, opts.pageSize));\n  const tmdbPagesNeeded = Math.max(1, Math.ceil(pageSize / TMDB_PAGE_SIZE));\n  const startTmdbPage = (page - 1) * tmdbPagesNeeded + 1;', 'const page = Number.isFinite(opts.page) ? Math.max(1, Math.floor(opts.page)) : 1;\n  const pageSize = Number.isFinite(opts.pageSize) ? Math.min(100, Math.max(1, Math.floor(opts.pageSize))) : 60;\n  const offset = (page - 1) * pageSize;\n  const skip = offset % TMDB_PAGE_SIZE;\n  const tmdbPagesNeeded = Math.ceil((skip + pageSize) / TMDB_PAGE_SIZE);\n  const startTmdbPage = Math.floor(offset / TMDB_PAGE_SIZE) + 1;');
 s = s.replace('.flatMap((r) => r?.results ?? [])\n    .map(opts.map)', '.flatMap((r) => r?.results ?? [])\n    .slice(skip, skip + pageSize)\n    .map(opts.map)');
 s = s.replace('Math.ceil(tmdbTotalPages / tmdbPagesNeeded)', 'Math.ceil(tmdbTotalResults / pageSize)');
 s = s.replace('pageSize: pageSize + 40, // headroom after dropping anime/dramas', 'pageSize, // Keep page offsets stable; filtering must not discard the next window.');
 // Newest means released, not far-future announcements.
 s = s.replace('    sort_by: tmdbSortParam(sort, "movie"),', '    ...(sort === "newest" ? { "primary_release_date.lte": new Date().toISOString().slice(0, 10) } : {}),\n    sort_by: tmdbSortParam(sort, "movie"),');
 s = s.replaceAll('    sort_by: tmdbSortParam(sort, "tv"),', '    ...(sort === "newest" ? { "first_air_date.lte": new Date().toISOString().slice(0, 10) } : {}),\n    sort_by: tmdbSortParam(sort, "tv"),');
 return s;
});
