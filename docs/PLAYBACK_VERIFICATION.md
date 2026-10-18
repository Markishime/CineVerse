# Licensed playback verification

The legal playback resolver tries each approved source in priority order. A
missing hosted asset or unavailable Cloudflare configuration does not prevent
another approved provider from being selected. License status, region,
expiration, and embedding permission still apply to every fallback.

Episode requests require an episode-specific match. A movie-level source cannot
fulfill a request containing season and episode numbers. Trailers are never
reported as full playback.

Archive embeds retain iframe mode; direct video files use the video player.
HLS mode follows the resolved manifest URL, including signed URLs with query
parameters. Cloudflare iframe mode returns the iframe URL.

Production rejects local `demo:` authentication tokens, including `demo:admin`.
Restricted library access requires an authenticated UID and the existing
allowlisted account email. Client-supplied email headers and query parameters
do not grant access.

## Release checks

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
Regression tests cover fallback selection, episode isolation, source license
regions and expiration, player modes, malformed URLs, and production demo-token
rejection.

Source resolution verifies records and configuration. It does not prove a
third-party stream is online or licensed for a particular user. Verify actual
playback with an authorized asset and account before describing a title as
working. Commercial titles require rights documentation and configured media
assets; adding metadata or a provider name does not create a playable stream.
