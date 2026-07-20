# Known limitations

1. **Seed catalog mode** — Without TMDB/AniList secrets and Firestore sync, the Next.js API serves curated seed data for development and demos.
2. **In-memory user store** — When Firebase Admin is not configured, library/reviews use a process-local store (resets on server restart). Production uses Firestore via Functions.
3. **Episode metadata** — Episodes are never invented; seed mode shows structural placeholders labeled as unavailable until provider sync.
4. **3D hero** — Disabled in Performance mode, reduced-motion, low-end devices, Save-Data, and when WebGL is missing.
5. **People pages** — Full filmography requires live provider credit sync.
6. **FCM push** — Client scaffolding present; production requires VAPID keys and device registration flows.
7. **Image URLs** — Remote posters depend on TMDB/AniList CDNs; missing posters show graceful fallbacks.
8. **Rules unit tests** — Static assertions always run; full emulator integration tests require `firebase emulators:exec`.
