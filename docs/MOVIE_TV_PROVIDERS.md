# Movie, series and drama playback

Filipino movies and series start on **VidRock**, then **2Embed CC**, VidSrc SH,
MultiEmbed, VidFast, 2Embed, 2Embed Skin, VidSrc PM, and AutoEmbed. Tagalog/Filipino
language or a Philippine production country selects this order. Anime keeps its
existing provider list even when Philippine locale hints are present.

Other movies, series and dramas keep VidFast first, then VidRock, VidSrc SH,
MultiEmbed, 2Embed CC, 2Embed, 2Embed Skin, VidSrc PM, and AutoEmbed. Nine servers
appear in their Servers menu. The additional providers are excluded from anime.

Each server receives the same TMDB ID. TV URLs include the selected season and
episode; MultiEmbed additionally requires `tmdb=1` to interpret numeric IDs
correctly. No account, new environment variable or server-side resolver is needed.

Endpoint references:

- [VidRock embedding documentation](https://vidrock.net/)
- [VidSrc SH API documentation](https://vidsrc.sh/vidsrc/docs/)
- [MultiEmbed simple integration](https://www.superembed.stream/)
- [2Embed CC integration](https://www.2embed.cc/#api)

2Embed CC is a separate endpoint from the existing .online and .skin entries.
Its movie route is `/embed/{tmdbId}`; its documented TV route is
`/embedtv/{tmdbId}&s={season}&e={episode}`. Keep the ampersands in the TV path.

Use **Servers** to pick an alternative, or **Next server** when a host loads but
has no playable stream. Explicit player errors and frame load failures advance
automatically. A silent iframe alone does not prove a title is unavailable, so
the player retains hosts that need a user click to start.

Provider catalogs vary by title and region. HTTP responses and routing tests
verify integration, not availability of every movie or actual video playback.

## Playback investigation — 19 October 2026

Browser checks used a CineVerse-origin iframe with its production referrer policy
and inspected real media duration, decoded video readiness, and advancing playback
time. This distinguishes movie playback from an HTTP 200, loaded iframe, poster,
advertisement, or provider title message.

- VidFast returned a 403 response with `X-Frame-Options: SAMEORIGIN`, which the
  browser refused to embed. A browser can fire iframe `load` for such a failure;
  `onerror` is not a reliable detector. Leaving it first kept the Filipino player
  on a blocked frame. Philippine locale detection now selects VidRock first.
- A separate server-side classification error blocked *Hello, Love, Goodbye*
  before the player rendered. TMDB keyword 9673 is **love**, and 9672 is **based
  on true story**, not nudity. Both were mistakenly in the shared adult exclusion
  list. They are now removed from public catalog exclusions and direct watch
  checks. Explicit-content flags and keywords still apply.
- VidRock played *Heneral Luna* (359105, about 118 minutes), *Hello, Love,
  Goodbye* (593961, about 117 minutes), and *Four Sisters and a Wedding*
  (205015, about 125 minutes), with advancing video time and ready state 4.
- The newly integrated 2Embed CC played *Hello, Love, Goodbye* through its nested
  player. Its other two sample films did not resolve during the checks; it is a
  fallback, not a promise of complete Philippine catalog coverage. Its poster
  requires Play; another click can be needed after the initial ad interaction.
- VidSrc SH played *Heneral Luna*, but the other two samples did not pass the
  same playback check. MultiEmbed, CineSrc, FilmU, Stellar, PrimeSrc, VidPhantom,
  VidLink, Cinezo, VidKing, 111Movies, Rive, VidPlus and Videasy did not pass in
  the tested cases/window. Failures included iframe blocking, inaccessible media
  hosts, catalog misses, and streams stuck at 0:00. They were not added as new
  providers based only on their advertised catalogs.

Run repeatable, opt-in external playback checks against a running build:

```powershell
$env:CHECK_EXTERNAL_PLAYBACK = '1'
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3101'
npx playwright test e2e/filipino-playback-live.spec.ts
```

These checks visit the real canonical movie pages and require decoded video time
above two seconds with a feature-length duration. They contact external servers
and are skipped in ordinary test runs. Availability can change with time/network.
