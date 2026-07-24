# CineVerse

Premium entertainment discovery and tracking for **movies**, **series**, **anime**, and **K-dramas**.

**Celestial Noir** design system · Next.js App Router · Firebase · legal discovery only (no unauthorized streaming).

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Firebase/TMDB secrets the app runs on curated **seed catalog** + in-memory user APIs for local development.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit + rules static tests |
| `npm run test:e2e` | Playwright e2e |
| `npm run emulators` | Firebase Emulator Suite (Auth/Firestore local) |
| `npm run deploy:rules` | Deploy Firestore/Storage rules only (not Hosting) |

**Deploy the app on Vercel** — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Firebase Hosting is not used.

## Stack

- **Frontend:** Next.js App Router, React, TypeScript strict, Tailwind, TanStack Query, Zustand, RHF + Zod, Framer Motion, GSAP, Lenis, R3F/Drei, Embla, Lucide
- **Backend:** Next.js `/api/v1/*` + Firebase Cloud Functions v2, Firestore, Storage, Auth
- **Providers (server only):** TMDB, AniList GraphQL, optional TVMaze

## Documentation

- [API](docs/API.md)
- [Firebase setup](docs/FIREBASE_SETUP.md)
- [Provider setup](docs/PROVIDER_SETUP.md)
- [Deployment](docs/DEPLOYMENT.md)
- [PWA & Play Store](docs/PWA_PLAY_STORE.md)
- [Security checklist](docs/SECURITY_CHECKLIST.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)

## Legal playback

Full-length media plays only when rights are verified server-side (active license, region allowed). Otherwise users see official trailers and legal watch providers.

## License

Proprietary — all rights reserved unless otherwise stated.
