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

## AniList

- Public GraphQL endpoint: `https://graphql.anilist.co`
- No API key required for read-only catalog queries
- Respect rate limits; use cache-first sync jobs

Filters applied:

- `type: ANIME` only
- Exclude adult titles
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
