# Provider setup guide

## TMDB

1. Create an account at [themoviedb.org](https://www.themoviedb.org/)
2. Request an API **Read Access Token** (v4 bearer)
3. Store as Firebase Functions secret:

```bash
firebase functions:secrets:set TMDB_ACCESS_TOKEN
```

4. For local Next.js server routes that call adapters:

```
TMDB_ACCESS_TOKEN=your_token
```

Attribution: display “This product uses the TMDB API but is not endorsed or certified by TMDB.”

## AniDB (all anime, including hentai)

AniDB is the primary anime metadata source. Register your own HTTP API client
with [AniDB](https://anidb.net/perl-bin/animedb.pl?show=client), then configure
these server-only values in `.env.local` and your hosting environment:

```text
ANIDB_CLIENT=your_registered_client
ANIDB_CLIENT_VERSION=1
ANIDB_CACHE_DIR=/absolute/path/to/persistent/anidb-cache
```

`ANIDB_CLIENT_NAME` is also supported for existing configurations.

Run one importer per cache directory:

```bash
npm run sync:anidb -- --ids=23,69
npm run sync:anidb -- --all
```

The first command imports selected titles. The second walks AniDB's complete
official title index, including restricted titles, and switches full anime browsing
to the AniDB snapshot after a successful import. It resumes from cached records
after interruption. Records are reused for at least 24 hours; outbound HTTP calls
are serialized at four-second intervals and API errors stop the import with a
24-hour cooldown. A complete import can take many hours. Run it as a separate job,
not inside a browse request. See [AniDB's HTTP API documentation](https://wiki.anidb.net/HTTP_API_Definition).

Without `ANIDB_CACHE_DIR`, the server uses `cineverse-anidb` in the OS temporary
directory. Production needs the same persistent cache available to the importer
and app, or a copy of the completed cache deployed with the app. Ephemeral serverless
filesystems do not share this cache across instances. Keep it outside `public/`.

AniDB supplies titles, alternate names, descriptions, art, formats, dates, episode
counts, regular episode names, studios, tags, and ratings. Existing saved content
identities and playback IDs survive metadata updates. While an import is incomplete
or AniDB is unconfigured/unavailable, existing AniList discovery remains available;
imported AniDB metadata overrides matching titles. Partial imports never replace the
complete browse catalog. Matching is exact and rejects ambiguous title matches.

Restricted anime appears in Anime Series (films in Anime Movies) for the existing
authorized adult account. Vivamax and other Filipino films use TMDB in Filipino
Movies with the Philippine release region. Adult entries are included in the normal
catalogs for authorized viewers; there are no separate adult navbar links.

## AniDB stream playback (anime + hentai)

Playback no longer depends on AniDB metadata credentials. The `anidb` embed
provider resolves an `anidb.app` player URL from the title + absolute episode
number through the public AniDB scraper worker:

```text
GET https://anidb-scraper-api.sapis.workers.dev/api/search?q={title}
GET https://anidb-scraper-api.sapis.workers.dev/api/anime/{slug}
GET https://anidb-scraper-api.sapis.workers.dev/api/watch/{episodeId}   → embedUrl
```

CineVerse proxies this with `resolveAnidbEmbed()` behind
`GET /api/v1/playback/anime-embed?provider=anidb&title=…&episode=…` — no API key
or env var. Chain position:

- **Adults-only / hentai anime** — `anidb` leads the server list, then all eleven
  TMDB hosts (VidFast, VidRock, VidSrc SH, MultiEmbed, 2Embed CC, VidLink,
  VidSrc, 2Embed, 2Embed Skin, VidSrc PM, AutoEmbed), then Cinezo. TMDB identity
  is resolved with `include_adult=true` so 18+ titles get the same eleven servers
  as movies and series.
- **Regular anime** — general hosts first, then Cinezo, then `anidb`.
- **MegaPlay is disabled** — it returned a 410 error shell (with HTTP 200) for
  every tested title, so it is no longer in the automatic chain. See
  `docs/KNOWN_LIMITATIONS.md`.
- Titles that have an AniDB id but no AniList/MAL/TMDB id still get a server
  (`providerIds.anidb` counts as playable identity).

Unresolvable titles (backend down, title not in the AniDB catalog, episode
missing) fail the async resolve and the player advances to the next server.

## AniList (discovery fallback)

- Public GraphQL endpoint: `https://graphql.anilist.co`
- No API key required for read-only catalog queries
- Respect rate limits; use cache-first sync jobs

Filters applied:

- `type: ANIME` only
- Exclude adult titles for viewers without adult access
- Formats: TV, Movie, OVA, ONA, Special, Short
- Require title + cover

## TVMaze

Optional fallback for TV schedules:

- Base: `https://api.tvmaze.com`
- No key for basic usage
- Map into CineVerse episode model only when TMDB episodes missing

## Security

- Frontend **must not** call TMDB with your token
- All provider traffic goes through Next.js `/api/v1/*` or Cloud Functions
- Normalize responses before returning to the UI
