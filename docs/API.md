# CineVerse API

Base path: `/api/v1` (Next.js App Router) or Cloud Functions `api` HTTPS endpoint.

All mutating routes require `Authorization: Bearer <Firebase ID token>` unless noted.

Provider API keys (TMDB, etc.) are **never** returned to clients.

## Catalog

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/home` | optional | Homepage collections |
| GET | `/movies` | public | Paginated movies |
| GET | `/series` | public | Paginated series |
| GET | `/anime` | public | Paginated anime |
| GET | `/kdrama` | public | Paginated K-dramas |
| GET | `/discover` | public | Filtered discovery |
| GET | `/search?q=` | public | Unified search |
| GET | `/content/:id` | public | Content by id |
| GET | `/content/slug/:slug` | public | Content by slug |
| GET | `/content/:id/credits` | public | Cast & crew |
| GET | `/content/:id/trailers` | public | Official trailers |
| GET | `/content/:id/providers` | public | Legal watch providers |
| GET | `/content/:id/recommendations` | public | Similar + reasons |
| GET | `/content/:id/seasons` | public | Seasons |
| GET | `/content/:id/playback` | public | Rights-gated playback eligibility |
| GET | `/seasons/:id/episodes` | public | Episodes |

## User

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/PATCH/DELETE | `/me` | required | Profile |
| PATCH | `/me/settings` | required | Preferences |
| GET | `/me/library` | required | Library list |
| PUT/PATCH/DELETE | `/me/library/:contentId` | required | Library entry |
| GET | `/me/favorites` | required | Favorites |
| PUT/DELETE | `/me/favorites/:contentId` | required | Favorite toggle |
| POST | `/content/:id/reviews` | required | Create review |
| PATCH/DELETE | `/reviews/:id` | required | Own review |
| GET/POST | `/me/collections` | required | Collections |
| PATCH/DELETE | `/me/collections/:id` | required | Collection |
| GET | `/me/notifications` | required | Notifications |
| GET | `/profiles/:username` | public | Public profile |

## Admin

Requires Firebase custom claim `admin: true`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/dashboard` | Metrics & health |
| POST | `/admin/sync/:jobType` | Queue sync job |
| PATCH | `/admin/content/:id/classification` | Override type |
| POST | `/admin/content/merge` | Merge duplicates |
| POST | `/admin/content/:id/refresh` | Refresh one title |
| PATCH | `/admin/reports/:id` | Moderate report |
| POST | `/admin/rights` | Upsert content rights |

## Playback policy

`GET /content/:id/playback` returns `eligible: true` only when server-side rights verification passes:

- Rights verified
- Playback permitted
- License active
- User region allowed

Otherwise clients receive trailer + legal provider options only. No piracy sources.
