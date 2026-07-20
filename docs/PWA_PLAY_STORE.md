# PWA & Play Store (TWA) guide

## PWA features

- Web manifest: `public/manifest.webmanifest`
- Service worker: `public/sw.js`
- Offline page: `/offline`
- Installable standalone display
- Share target → `/search`
- Maskable icons under `public/icons/`
- Safe-area CSS for notched devices
- Update prompt via `RegisterServiceWorker`

## Meaningful offline functionality

Beyond a website wrapper:

- Offline shell + offline page
- Guest watchlist / favorites in `localStorage` (Zustand persist)
- Cached catalog pages when previously visited
- Settings performance mode works offline

## Bubblewrap (Trusted Web Activity)

1. Deploy HTTPS production origin with valid Digital Asset Links
2. Install Bubblewrap:

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://YOUR_DOMAIN/manifest.webmanifest
bubblewrap build
```

3. Host `/.well-known/assetlinks.json` with your app signing cert SHA-256
4. Upload AAB to Play Console

## Play policy notes

- Do not claim full unauthorized streaming
- Disclose content sources (TMDB/AniList) and account data use
- Provide account deletion path
