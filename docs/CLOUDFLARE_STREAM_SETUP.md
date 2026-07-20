# Cloudflare Stream setup — full movies & episodes on CineVerse

Use **Cloudflare Stream** (or Mux / Bunny / Vimeo) for real full video.  
**TMDB never provides full movie files** — only trailers/metadata.

```
TMDB  →  titles, posters, cast, seasons, episode names
Firestore  →  movie/episode → video mapping + rights
Cloudflare Stream  →  actual encoded video files
CineVerse player  →  Stream iframe / HLS inside the site
```

---

## Step 1 — Create Cloudflare Stream

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)  
2. Open **Stream** → enable the product  
3. Create an **API token** with **Stream:Edit** (and Account Stream permissions)  
4. Copy:

| Value | Env var |
|-------|---------|
| Account ID | `CLOUDFLARE_ACCOUNT_ID` |
| API token | `CLOUDFLARE_STREAM_TOKEN` |
| Customer code (subdomain) | `NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE` or `CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN` |

Customer code is the `xxxx` in:

```
https://customer-xxxx.cloudflarestream.com/{videoUid}/iframe
```

### Optional signed (protected) playback

| Value | Env var |
|-------|---------|
| Signing private key (PEM) | `CLOUDFLARE_STREAM_SIGNING_KEY` |
| Key id | `CLOUDFLARE_STREAM_SIGNING_KEY_ID` |
| Force signed only | `CLOUDFLARE_STREAM_REQUIRE_SIGNED=1` |

Never store permanent public links in Firestore when signed playback is required.

### Example `.env.local`

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_STREAM_TOKEN=your_api_token
NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE=your_customer_code

# Optional protection
# CLOUDFLARE_STREAM_SIGNING_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# CLOUDFLARE_STREAM_SIGNING_KEY_ID=your_kid
# CLOUDFLARE_STREAM_REQUIRE_SIGNED=1
```

Restart `npm run dev` after changing env.

---

## Step 2 — Upload a movie (large files)

### A) Admin direct-upload URL (recommended)

As an **admin** (Firebase claim `admin: true`):

```http
POST /api/v1/admin/stream/direct-upload
Authorization: Bearer <firebase_id_token>
Content-Type: application/json

{
  "name": "My Licensed Movie",
  "maxDurationSeconds": 14400,
  "requireSignedURLs": false
}
```

Response:

```json
{
  "uploadURL": "https://upload.cloudflarestream.com/...",
  "uid": "cloudflare_video_uid_here",
  "next": { "exampleSource": { ... } }
}
```

Upload the file **to `uploadURL`** (browser `fetch` PUT/POST or tus).  
Keep the returned **`uid`** — that is your Stream video id.

### B) Small file server upload (Node)

```ts
import { uploadMovieBuffer } from "@/lib/playback/cloudflare-stream";
import fs from "node:fs";

const buf = fs.readFileSync("./movie.mp4");
const { uid } = await uploadMovieBuffer(buf, { name: "movie.mp4" });
// save uid → playbackSources
```

For multi‑GB films prefer **direct_upload** / resumable uploads (A).

---

## Step 3 — Map video UID in CineVerse (playback source)

### Full movie

```http
POST /api/v1/admin/playback-sources
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "titleId": "seed_movie_my_film",
  "sourceType": "cloudflare_stream",
  "providerName": "Cloudflare Stream",
  "cloudflareVideoUid": "cloudflare_video_uid_here",
  "playbackAssetId": "cloudflare:cloudflare_video_uid_here",
  "contentKind": "full_movie",
  "status": "approved",
  "rightsHolder": "CineVerse Studios / Licensor",
  "rightsBasis": "owned",
  "embeddingAllowed": true,
  "allowedRegions": ["*"],
  "blockedRegions": [],
  "monetizationAllowed": true,
  "evidenceDocumentPaths": ["rights/evidence/my_license.md"]
}
```

`titleId` must match catalog id (e.g. `seed_movie_…`, `tmdb_movie_550`).

### Full episode (one UID per episode)

```json
{
  "titleId": "seed_series_my_show",
  "episodeId": "seed_series_my_show_s1_e1",
  "seasonNumber": 1,
  "episodeNumber": 1,
  "sourceType": "cloudflare_stream",
  "providerName": "Cloudflare Stream",
  "cloudflareVideoUid": "episode_video_uid",
  "playbackAssetId": "cloudflare:episode_video_uid",
  "contentKind": "full_episode",
  "status": "approved",
  "rightsHolder": "Licensor",
  "rightsBasis": "direct_license",
  "embeddingAllowed": true,
  "allowedRegions": ["PH", "US"],
  "evidenceDocumentPaths": ["rights/evidence/series_license.md"]
}
```

| Episode | Stream UID |
|---------|------------|
| S1E1 | `video_uid_a` |
| S1E2 | `video_uid_b` |
| S1E3 | `video_uid_c` |

**Never** generate a stream from TMDB episode ids.

---

## Step 4 — Play inside CineVerse

Resolution path (already wired):

1. User opens title / episode → **Watch Now**  
2. `GET /api/v1/content/:id/playback` or `POST /api/v1/playback/session`  
3. Server loads **approved** `playbackSources` (not TMDB `/videos`)  
4. For `cloudflare_stream` → `StreamPlayer` iframe:

```
https://customer-{CODE}.cloudflarestream.com/{videoUid}/iframe
```

Optional signed `token` query when signing is configured.

Client components:

- `src/components/content/stream-player.tsx` — Cloudflare iframe  
- `src/components/content/media-player.tsx` — picks Stream / YouTube / Archive / HLS  
- `src/lib/playback/cloudflare-stream.ts` — upload + signed URLs  
- `src/lib/playback/resolve-playback.ts` — rights-aware resolve  

Public resolve (no TMDB stream):

```
GET /api/v1/playback/source?titleId=movie_123
GET /api/v1/playback/source?titleId=series_456&episodeId=series_456_s1_e1
```

---

## YouTube official full upload (alternative)

Only if the **rights holder** uploaded the **full** film and enabled embed:

```json
{
  "titleId": "movie_123",
  "sourceType": "youtube_embed",
  "youtubeVideoId": "FULL_VIDEO_ID",
  "contentKind": "full_movie",
  "status": "approved",
  "rightsHolder": "Official Studio Channel",
  "rightsBasis": "creator_permission",
  "embeddingAllowed": true,
  "allowedRegions": ["*"],
  "evidenceDocumentPaths": ["rights/evidence/youtube_official.md"]
}
```

Do **not** use TMDB trailer keys as full movies.  
Do **not** auto-search YouTube for “full movie”.

---

## Why you only saw trailers before

TMDB:

```
GET /movie/{id}/videos
```

usually returns **Trailer / Teaser / Clip** — not the feature film.

CineVerse must resolve from **your** `playbackSources` with:

- `status: approved`
- `contentKind: full_movie` or `full_episode`
- real `cloudflareVideoUid` or `youtubeVideoId`

---

## Checklist

- [ ] Stream enabled + customer code in env  
- [ ] Video uploaded → you have a **uid**  
- [ ] Rights evidence markdown exists  
- [ ] Admin created `playbackSources` row (movie **or** each episode)  
- [ ] `status: approved`  
- [ ] Open title → **Watch Now** plays Stream iframe  
- [ ] Series: every episode has its **own** uid  

---

## Partner content (anime / K-drama / indie)

For free legal growth without piracy:

- Independent studios, student films, web series, creator-owned shows  
- Written permission for: embed on CineVerse, countries, ads/subs, dates, posters/subs  

Then upload each file to Stream and map as above.

Related:

- `docs/ADD_PLAYBACK_CONTENT.md` — Archive free catalog + general mapping  
- `docs/LEGAL_STREAMING.md` — forbidden sources & architecture  
