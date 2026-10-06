const fs = require('fs');
function edit(p, fn) { fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); }
edit('src/components/home/home-page.tsx', s => {
 s = s.replace('staleTime: 15_000', 'staleTime: 60_000').replace('refetchInterval: 60_000', 'refetchInterval: 5 * 60_000');
 s = s.replace('liveLabel="Popular & trending today"', 'liveLabel={home.catalogStatus === "live" ? "Popular & trending today" : "Discover your next watch"}');
 s = s.replace('{isError && (', '{(isError || home.catalogStatus === "fallback") && (');
 s = s.replace('Live catalog is slow right now — showing offline picks.', 'Showing saved picks. Live availability may be limited.');
 s = s.replace('onClick={() => void refetch()}', 'disabled={isFetching}\n              onClick={() => void refetch()}');
 s = s.replace('        {/* ── Popular (day-trending when available) ── */}', `        <nav aria-label="Browse catalogs" className="flex flex-wrap gap-2">
          {[["Movies", "/movies"], ["Series", "/series"], ["Anime", "/anime"], ["K-dramas", "/kdrama"], ["J-dramas", "/jdrama"], ["C-dramas", "/cdrama"], ["Thai dramas", "/thaidrama"]].map(([label, href]) => (
            <Link key={href} href={href} className="rounded-full border border-white/15 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[var(--primary)]">{label}</Link>
          ))}
        </nav>
        <ContentRow title="Latest movies" subtitle="Newest released films in the catalog" items={home.latestMovies ?? []} wide />
        <ContentRow title="Latest series" subtitle="Recently premiered series" items={home.latestSeries ?? []} />
        <ContentRow title="Latest anime" subtitle="Recent anime releases and premieres" items={home.latestAnime ?? []} />
        <ContentRow title="Latest dramas" subtitle="Recent K, J, C, Thai and Filipino premieres" items={home.latestDramas ?? []} />

        {/* Popularity is separate from release date. */}`);
 s = s.replace(/        \{\/\* ── All catalogs[\s\S]*?        \{\(home.animeMovies/, '        {(home.animeMovies');
 s = s.replace(/        <ContentRow\n          title="New releases"[\s\S]*?        \/>\n/, '');
 s = s.replace(' sm:px-6 will-change-transform', ' sm:px-6');
 return s;
});
edit('src/lib/api/home-fallback.ts', s => 'import { latestRows } from "@/lib/content/latest";\n' + s.replace('    newReleases,', '    catalogStatus: "fallback",\n    ...latestRows(safe),\n    newReleases,'));
for (const country of ['korean', 'japanese', 'chinese', 'thai']) edit(`src/app/movies/${country}/page.tsx`, s => s.replace('      matureOnly\n', ''));
fs.writeFileSync('src/app/movies/filipino/page.tsx', `import { CatalogPage } from "@/components/content/catalog-page";
export default function FilipinoMoviesPage() {
  return <CatalogPage type="movie" country="PH" title="Filipino Movies" subtitle="Explore Filipino drama, comedy, and independent cinema" />;
}
`);
edit('src/components/layout/header.tsx', s => s.replace('    matureChildren: true,\n', '').replace(/    \/\/ Country movie catalogs are restricted[^\n]*\n    \/\/[^\n]*\n/, ''));
edit('src/stores/performance-store.ts', s => s.replace('effective: "cinematic",', 'effective: "balanced",').replace('  const et = nav.connection?.effectiveType;', '  if (nav.connection?.saveData) return true;\n  const et = nav.connection?.effectiveType;'));
edit('src/components/providers/smooth-scroll-provider.tsx', s => s.replace('effective === "performance"', 'effective !== "cinematic"'));
edit('src/components/home/hero-carousel.tsx', s => {
 s = 'import { usePerformanceStore } from "@/stores/performance-store";\n' + s.replace('"use client";\n', '');
 s = '"use client";\n' + s;
 s = s.replace('  const reduceMotion = useReducedMotion() ?? false;', '  const reduceMotion = useReducedMotion() ?? false;\n  const effective = usePerformanceStore((s) => s.effective);');
 s = s.replace('const playbackAllowed = heroInView && docVisible;', 'const playbackAllowed = heroInView && docVisible && !reduceMotion && effective === "cinematic";');
 return s;
});
// Make builds independent of a Google Fonts connection, retaining the existing font roles.
edit('src/app/layout.tsx', s => s.replace('import { Inter, Sora, Instrument_Serif } from "next/font/google";\n', '').replace(/const inter = Inter\([\s\S]*?export const metadata/, 'export const metadata').replace('className={`${inter.variable} ${sora.variable} ${instrument.variable} dark`}', 'className="dark"'));
edit('src/app/globals.css', s => s.replace(':root {', ':root {\n  --font-inter: "Segoe UI";\n  --font-sora: "Segoe UI";\n  --font-instrument: Georgia;'));
// Ignore generated deployment bundles, not source code.
edit('eslint.config.mjs', s => s.replace('    ".next/**",', '    ".next/**",\n    "hosting-dist/**",\n    "functions/lib/**",\n    ".firebase/**",\n    "test-results/**",'));
