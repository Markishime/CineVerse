# Deployment guide

## Prerequisites

- Node 20+
- Firebase CLI
- TMDB token secret
- Firebase project configured

## Environment

Copy `.env.example` → `.env.local` and fill values.

## Web (Vercel / Node host)

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run start
```

Point `NEXT_PUBLIC_API_BASE_URL` to same-origin `/api/v1` or Functions URL.

## Firebase Functions

```bash
cd functions
npm ci
npm run build
cd ..
firebase deploy --only functions
```

## Rules & indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## Hosting options

1. **Next.js host** (recommended): Vercel/Cloud Run for App Router + API routes
2. **Firebase App Hosting** or Hosting rewrite to Cloud Run
3. Static export is **not** recommended (API routes required)

## Post-deploy checklist

- [ ] Auth providers work
- [ ] App Check enforced
- [ ] Admin claim assigned to operators only
- [ ] Scheduled functions visible in console
- [ ] TMDB secret bound to functions
- [ ] Privacy/terms pages live
- [ ] Playback gate returns false for non-rights content
