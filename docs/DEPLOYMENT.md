# Deployment guide

CineVerse is a **Next.js App Router** app. Deploy the web app on **Vercel** (recommended). Firebase is used only for Auth / Firestore / Storage — not Hosting.

## Prerequisites

- Node 20+
- Vercel project linked (`vercel` CLI or Git integration)
- TMDB Read Access Token (metadata)
- Firebase web app config (Auth)

## Environment (Vercel)

In the Vercel project → **Settings → Environment Variables**, set at least:

| Variable | Required | Notes |
| --- | --- | --- |
| `TMDB_ACCESS_TOKEN` | **Yes** (for catalog posters) | TMDB v4 Bearer token. Without it, watch pages still play via embeds, but metadata is thinner. |
| `NEXT_PUBLIC_API_BASE_URL` | No | Default `/api/v1` (same origin) |
| `NEXT_PUBLIC_APP_URL` | No | Your production URL, e.g. `https://your-app.vercel.app`. If empty, `VERCEL_URL` is used. |
| `NEXT_PUBLIC_FIREBASE_*` | For Auth | Same keys as local `.env.local` |

Copy from `.env.example`. **Do not** set Firebase Hosting URLs (`*.web.app`).

## Web (Vercel)

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

Push to the connected Git branch, or:

```bash
npx vercel --prod
```

Framework preset: **Next.js**. No `output: "export"` — API routes are required.

## Post-deploy checklist

- [ ] Open `/watch/movie/550` (or any catalog title) — player loads, **not** “Lost in the nebula”
- [ ] Home rows show posters (confirms `TMDB_ACCESS_TOKEN`)
- [ ] Auth sign-in works (Firebase client env)
- [ ] Mobile: hard-refresh or “Update now” if an old service worker cached a 404
- [ ] Privacy / terms pages live

## Firebase (optional backend only)

Rules / indexes (not hosting):

```bash
npm run deploy:rules
```

Cloud Functions (if used):

```bash
cd functions
npm ci
npm run build
cd ..
firebase deploy --only functions
```

## Hosting options

1. **Vercel** (recommended) — App Router + `/api/v1/*`
2. **Cloud Run / Node** — `npm run build && npm run start`
3. **Firebase Hosting** — not used; static export is **not** supported

## Why watch used to 404

`/watch/movie/[id]` and `/watch/tv/...` previously called `notFound()` when TMDB metadata failed. On Vercel without `TMDB_ACCESS_TOKEN`, every play link showed “Lost in the nebula”. Playback now falls back to the TMDB id and still loads embed providers.
