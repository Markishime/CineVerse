# How to put full movies and episodes on CineVerse

TMDB / AniList only give **posters, titles, and episode names**.  
They do **not** give playable video files.

To get **Watch Now** on this site you must add a **legal video source** for each movie or each episode.

```
Metadata (automatic)          Video (you add manually)
─────────────────────         ────────────────────────
TMDB / AniList / TVMaze   +   YouTube embed
posters, seasons, eps         OR Archive.org public domain
                              OR Cloudflare Stream / Vimeo
                              OR your own licensed file
```

---

## Why you see “No episode list yet”

That screen means:

1. The title is **series / anime / k-drama** (not a movie), and  
2. Either seasons/episodes failed to load from TMDB/TVMaze/Jikan, **or**  
3. You opened a modern commercial title that has **no free episode records** in CineVerse.

**What works today without extra setup**

| Catalog | Open this filter | Examples |
|--------|-------------------|----------|
| Movies | **Watch Now · free full** | Metropolis, Nosferatu, Night of the Living Dead, … |
| Series | **Watch Now · free full** | Flash Gordon, Dick Tracy, Free Horror Anthology, … |
| Anime | **Watch Now · free full** | Free demo anime rows |
| K-Drama | **Watch Now · free full** | Free demo K-catalog rows |

Commercial Netflix / Crunchyroll / modern K-drama **will not** stream until **you** add licensed sources.

---

## Golden rules

1. **One video source per movie** (`contentKind: full_movie`).  
2. **One video source per episode** (`contentKind: full_episode`) — never one URL for every episode.  
3. Only use content you **own**, **licensed**, **public domain**, or **official embed-enabled** YouTube.  
4. Store **IDs** (YouTube video id, Archive identifier, Stream UID) — never pirated m3u8 scrapes.

---

# Option A — Easiest: add free public-domain movies (code)

### Files

| File | Purpose |
|------|---------|
| `src/lib/playback/free-movies.ts` | List of free full movies |
| `src/lib/playback/seed-sources.ts` | Auto-builds playback records (do not hand-edit each movie if using free-movies) |
| `docs/rights/evidence/*.md` | Short rights note for each title |

### Steps

1. Find a **public-domain** film on [archive.org](https://archive.org).  
2. Open the item → copy the **identifier** from the URL:

   ```
   https://archive.org/details/night_of_the_living_dead
                              └────── identifier ──────┘
   ```

3. Confirm embed works:

   ```
   https://archive.org/embed/night_of_the_living_dead
   ```

4. Add an entry to `FREE_FULL_MOVIES` in `src/lib/playback/free-movies.ts`:

```ts
{
  seedId: "seed_movie_my_film",
  slug: "my-film-1920",
  title: "My Film",
  year: 1920,
  overview: "Short description. Free public-domain full film.",
  tmdbId: 12345, // optional — links metadata
  archiveId: "night_of_the_living_dead", // Archive identifier
  runtime: 90,
  genres: ["Drama"],
  posterPath: "https://image.tmdb.org/t/p/w500/....jpg", // optional
  evidence: "rights/evidence/my_film_us_pd_review.md",
},
```

5. Create `docs/rights/evidence/my_film_us_pd_review.md`:

```md
# Rights evidence — My Film (1920)

- Basis: US public domain
- Playback: Internet Archive embed `night_of_the_living_dead`
- Reviewed: your name · date
```

6. Restart dev server / redeploy:

```bash
npm run dev
# or
npm run build
```

7. Open **Movies → Watch Now · free full** → open the title → full film plays.

`seed-sources.ts` automatically creates playback rows for:

- `seed_movie_my_film`
- `tmdb_movie_12345` (if `tmdbId` set)

---

# Option B — Free series / anime / K-drama episodes (code)

### Files

| File | Purpose |
|------|---------|
| `src/lib/playback/free-shows.ts` | Free shows + **per-episode** list |
| `src/lib/playback/seed-sources.ts` | Builds one playback source **per episode** |

### Steps

1. Add a show to `FREE_FULL_SHOWS` in `src/lib/playback/free-shows.ts`.  
2. List **every episode** with its **own** `archiveId` (or same print only if that chapter is actually that file — prefer unique ids when you have them).

```ts
{
  seedId: "seed_series_my_show",
  slug: "my-show-1936",
  contentType: "series", // or "anime" | "kdrama"
  title: "My Show",
  year: 1936,
  overview: "Public-domain serial — free full episodes.",
  tmdbId: 1900, // optional
  genres: ["Action"],
  evidence: "rights/evidence/my_show_us_pd_review.md",
  episodes: [
    {
      seasonNumber: 1,
      episodeNumber: 1,
      name: "Chapter 1",
      archiveId: "MyShow_Chapter1",
      overview: "Episode synopsis.",
      runtime: 20,
    },
    {
      seasonNumber: 1,
      episodeNumber: 2,
      name: "Chapter 2",
      archiveId: "MyShow_Chapter2",
      overview: "Episode synopsis.",
      runtime: 20,
    },
  ],
},
```

3. Write the evidence markdown under `docs/rights/evidence/`.  
4. Restart / redeploy.  
5. Open **Series (or Anime / K-Drama) → Watch Now · free full** → title → Season 1 → **Watch Now** on each episode.

### Episode id format (automatic)

```
{seedId}_s{seasonNumber}_e{episodeNumber}
// e.g. seed_series_my_show_s1_e2
```

Playback records store:

- `titleId` = show seed id (and `tmdb_tv_*` alias if set)  
- `episodeId` = above  
- `seasonNumber` / `episodeNumber`  
- `contentKind` = `full_episode`  
- `status` = `approved`

---

# Option C — Official YouTube full movie / episode

Use only when:

- Uploaded by the **rights holder / studio**, and  
- **Embedding is allowed**, and  
- Legal in the viewer’s country.

### Playback source shape

```json
{
  "titleId": "seed_movie_my_film",
  "sourceType": "youtube_embed",
  "providerName": "Official Studio Channel",
  "youtubeVideoId": "abc123xyz",
  "contentKind": "full_movie",
  "status": "approved",
  "rightsHolder": "Official Studio Channel",
  "rightsBasis": "creator_permission",
  "embeddingAllowed": true,
  "allowedRegions": ["*"],
  "evidenceDocumentPaths": ["rights/evidence/my_film_youtube_review.md"]
}
```

For an episode:

```json
{
  "titleId": "seed_series_my_show",
  "episodeId": "seed_series_my_show_s1_e1",
  "seasonNumber": 1,
  "episodeNumber": 1,
  "sourceType": "youtube_embed",
  "youtubeVideoId": "epVideoIdHere",
  "contentKind": "full_episode",
  "status": "approved",
  "rightsHolder": "Official Channel",
  "rightsBasis": "creator_permission",
  "embeddingAllowed": true,
  "allowedRegions": ["*"]
}
```

From URL `https://www.youtube.com/watch?v=abc123xyz` store only `abc123xyz`.  
Do **not** download or scrape stream URLs.

Add YouTube sources in `seed-sources.ts` (or via admin API when enabled) the same way Archive sources are generated.

---

# Option D — You own or license the file (Cloudflare Stream)

**Recommended for commercial / licensed full movies and every series episode.**

Full walkthrough:

→ **[CLOUDFLARE_STREAM_SETUP.md](./CLOUDFLARE_STREAM_SETUP.md)**

### Short flow

```
1. License or own the video
2. POST /api/v1/admin/stream/direct-upload → uploadURL + uid
3. Upload file to uploadURL
4. POST /api/v1/admin/playback-sources with cloudflareVideoUid
5. User Watch Now → StreamPlayer iframe inside CineVerse
```

### Env

```env
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_STREAM_TOKEN=...
NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE=xxxx
# optional signed playback:
# CLOUDFLARE_STREAM_SIGNING_KEY=...
# CLOUDFLARE_STREAM_REQUIRE_SIGNED=1
```

### Example Cloudflare source (movie)

```json
{
  "titleId": "my_licensed_movie",
  "sourceType": "cloudflare_stream",
  "providerName": "Cloudflare Stream",
  "cloudflareVideoUid": "stream_uid_here",
  "playbackAssetId": "cloudflare:stream_uid_here",
  "contentKind": "full_movie",
  "status": "approved",
  "rightsHolder": "Your Company LLC",
  "rightsBasis": "owned",
  "embeddingAllowed": true,
  "allowedRegions": ["US", "PH"],
  "evidenceDocumentPaths": ["rights/evidence/my_license_contract.md"]
}
```

### Example (episode — unique uid each time)

```json
{
  "titleId": "series_001",
  "episodeId": "series_001_s1_e3",
  "seasonNumber": 1,
  "episodeNumber": 3,
  "sourceType": "cloudflare_stream",
  "cloudflareVideoUid": "video_uid_c",
  "contentKind": "full_episode",
  "status": "approved",
  "rightsHolder": "Licensor",
  "rightsBasis": "direct_license",
  "embeddingAllowed": true,
  "allowedRegions": ["*"],
  "evidenceDocumentPaths": ["rights/evidence/series_license.md"]
}
```

---

# Option E — Admin API (when you have admin claim)

1. Give your Firebase user custom claim `admin: true` (see `docs/FIREBASE_SETUP.md`).  
2. Sign in → open `/admin`.  
3. Create playback sources via:

   `POST /api/v1/admin/playback-sources`

   (or extend the admin UI to submit the JSON shapes above)

4. Keep `status: "pending_review"` until a human approves → then `approved`.

Only **approved** + valid region + unexpired sources become **Watch Now**.

---

## Checklist before you click “approved”

- [ ] You have a rights basis (public domain / license / official YouTube / ownership)  
- [ ] Evidence file path exists under `docs/rights/evidence/`  
- [ ] Movie: `contentKind: full_movie` and **no** `episodeId`  
- [ ] Episode: `contentKind: full_episode` + `episodeId` + `seasonNumber` + `episodeNumber`  
- [ ] Unique source per episode  
- [ ] Archive embed or YouTube embed tested in a browser  
- [ ] `status: "approved"`  
- [ ] `embeddingAllowed: true`  
- [ ] `allowedRegions` includes `*` or the user’s region  

---

## How the site decides the button label

| Condition | UI |
|-----------|-----|
| Approved full movie or episode source | **Watch Now** |
| Only official trailer on YouTube | **Watch Trailer** |
| Neither | **Not Available on CineVerse** |

APIs involved:

| Endpoint | Role |
|----------|------|
| `GET /api/v1/content/:id/playback` | Title-level Watch Now / Trailer |
| `POST /api/v1/playback/session` | Start free/full play session |
| `POST /api/v1/playback/resolve` | Resolve title or **specific episode** |
| `GET /api/v1/seasons/:id/episodes` | Episode list + `playable` flags |

---

## Quick test path (after you add content)

### Movie

1. `npm run dev`  
2. Go to `/movies` → **Watch Now · free full**  
3. Open your title → player should say **Watch Now · free full stream**  
4. Or open `/content/your-slug?play=full`

### Series episode

1. `/series` → **Watch Now · free full**  
2. Open show → **Seasons** → Season 1  
3. Each free episode shows gold **Watch Now**  
4. Click → full episode plays in the player  

If the list is empty: the show is not in `FREE_FULL_SHOWS` and TMDB episode fetch failed (set `TMDB_ACCESS_TOKEN` for metadata lists).

---

## What you must not do

- Do **not** paste piracy embed sites (vidsrc, 2embed, etc.)  
- Do **not** scrape Netflix / Disney+ / Crunchyroll / Max  
- Do **not** treat TMDB as a stream  
- Do **not** reuse one video URL for all episodes of a series  

---

## Minimal “I just want something playable” path

1. Use existing free titles:  
   - Movies: Metropolis, Nosferatu, Night of the Living Dead, …  
   - Series: Free Horror Anthology, Flash Gordon, …  
2. To add more free films: edit `free-movies.ts` + evidence file.  
3. To add more free episodic shows: edit `free-shows.ts` + evidence file.  
4. For licensed commercial catalogs: use Option D (Stream/Vimeo) + contracts, not scrapers.

Related docs:

- `docs/LEGAL_STREAMING.md` — architecture & forbidden sources  
- `docs/PROVIDER_SETUP.md` — TMDB token for episode **names** only  
- `docs/FIREBASE_SETUP.md` — admin custom claims  
