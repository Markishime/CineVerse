# Known limitations

1. **Seed catalog mode** — Without TMDB/AniList secrets and Firestore sync, the Next.js API serves curated seed data for development and demos.
2. **In-memory user store** — When Firebase Admin is not configured, library/reviews use a process-local store (resets on server restart). Production uses Firestore via Functions.
3. **Episode metadata** — Episodes are never invented; seed mode shows structural placeholders labeled as unavailable until provider sync.
4. **3D hero** — Disabled in Performance mode, reduced-motion, low-end devices, Save-Data, and when WebGL is missing.
5. **People pages** — Full filmography requires live provider credit sync.
6. **FCM push** — Client scaffolding present; production requires VAPID keys and device registration flows.
7. **Image URLs** — Remote posters depend on TMDB/AniList CDNs; missing posters show graceful fallbacks.
8. **Rules unit tests** — Static assertions always run; full emulator integration tests require `firebase emulators:exec`.
9. **Lint dependency advisory** — `eslint-config-next` still brings in `braces` 3.0.3 through `fast-glob` / `micromatch`. GHSA-vfj7-8cjw-p6xm has no published patched version as of 2026-10-18. This dependency is used by local lint tooling; the production dependency audit is clean. Do not downgrade Next.js or Firebase in response to `npm audit fix --force` suggestions.
10. **Third-party catalogs are incomplete** — The embed providers do not carry every TMDB title. Obscure, gravure/JAV-style, very old, and region-restricted releases can fail on every server. For example, TMDB 1257095 (*Ai Shinozaki “Love” is overflowing!*) is only legally distributed on region-locked Japanese services such as U-NEXT; all tested embed hosts returned not-found/catalog-miss pages. The player ends on a **Where to watch** / **Search JustWatch** panel instead of pretending a source exists. Do not describe a title as playable based only on TMDB metadata or an HTTP 200 from a provider.
