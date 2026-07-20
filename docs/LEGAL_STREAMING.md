# CineVerse legal streaming system

## Brand URL

- Primary: **https://cineverse-live.web.app**
- Legacy project site: https://original-mesh-469112-t3.web.app
- Note: `cineverse.web.app` is reserved by another Firebase project and cannot be claimed on this project. Connect a custom domain (e.g. `cineverse.app`) in Firebase Hosting if you own one.

## Architecture

| Layer | Role |
| --- | --- |
| TMDB / AniList / TVMaze / Jikan | **Metadata only** (posters, overviews, seasons, episode titles) |
| `playbackSources` | Source of truth for full/trailer playable assets |
| `titles` | Rights-aware catalog flags (`playable`, regions) |
| `/api/v1/content/[id]/playback` | Resolves in-app player payload |
| `/api/v1/playback/resolve` | Auth-required title/episode resolve |
| `/api/v1/playback/session` | Auth session → short-lived play payload |
| `/api/v1/admin/playback-sources` | Admin create / review |

```
TMDB (metadata)
  └── titles, posters, cast, seasons, episodes

YouTube official embeds
  └── free full content from verified rights holders (IFrame only)

Cloudflare Stream / Vimeo / CDN
  └── CineVerse-owned and directly licensed content (signed URLs)

Firebase
  ├── auth, progress, favorites
  └── playbackSources + rights approval
```

## UI states (every title)

| Condition | Label |
| --- | --- |
| Approved full source | **Watch Now** |
| Trailer only | **Watch Trailer** |
| Neither | **Not Available on CineVerse** |

## Approved source types

1. `youtube_embed` — official YouTube iframe (video **id only**, never download/stream URL)
2. `public_domain` — manually reviewed PD with evidence (e.g. Archive.org)
3. `creative_commons` — license + attribution required
4. `cineverse_hosted` — owned/licensed HLS/MP4 (short-lived signed URL / CDN)
5. `cloudflare_stream` — Stream UID → session-minted manifest (never store permanent signed URLs)
6. `vimeo_embed` — licensed Vimeo embeds
7. `licensed_partner` — disabled until `LICENSED_PARTNER_ENABLED` + contracts

## Episode rule

**Never** reuse one generic video URL for every episode. Resolve each episode with matching `titleId` + `episodeId` (or `seasonNumber` + `episodeNumber`) and `status === approved` + `contentKind === full_episode`.

## Forbidden

Piracy APIs, scraped iframes/m3u8, DRM bypass, torrents, restreaming Netflix/Disney+/Crunchyroll/etc., user-submitted unverified links, treating TMDB as a stream, downloading YouTube progressive URLs.

## Seed full titles

Public-domain films with evidence under `docs/rights/evidence/` — free in-app full playback:

- Metropolis (1927)
- Nosferatu (1922)
- Night of the Living Dead (1968)
- The Cabinet of Dr. Caligari (1920)
- The Phantom of the Opera (1925)
- Plan 9 from Outer Space (1959)
- Charade (1963)
- Detour (1945)
- His Girl Friday (1940)

## Mature (18+) library

- Metadata: R / NC-17 / TV-MA / AniList adult titles when user enables 18+ (age-gated)
- UI: `/mature` + home rows when mature is on
- Full streams: only when a rights-approved source exists (same legal pipeline)
- Forbidden: pirate embeds of commercial explicit content

## Admin workflow

1. Sign in with Firebase custom claim `admin: true`
2. Open `/admin` → Legal playback sources
3. POST new sources with evidence paths
4. Approve only after human review

## Env

```
NEXT_PUBLIC_APP_URL=https://cineverse-live.web.app
TMDB_ACCESS_TOKEN=...   # metadata only — never streams
PLAYBACK_CDN_BASE_URL=  # optional CDN for hosted assets
PLAYBACK_TRUSTED_HOSTS= # extra hosts for signed media
CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN= # optional Stream customer code
LICENSED_PARTNER_ENABLED= # leave unset until contracts
```

## Client players

- `YouTubeMoviePlayer` — `react-youtube` official IFrame
- `HlsPlayer` — `hls.js` for short-lived HLS/Stream manifests
- `VimeoPlayer` — official Vimeo embed iframe
- `MediaPlayer` — orchestrates Watch Now / Trailer / Unavailable

## How to add movies & episodes

- Free Archive / YouTube / general mapping → **[ADD_PLAYBACK_CONTENT.md](./ADD_PLAYBACK_CONTENT.md)**  
- **Cloudflare Stream (recommended hosting)** → **[CLOUDFLARE_STREAM_SETUP.md](./CLOUDFLARE_STREAM_SETUP.md)**
