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
