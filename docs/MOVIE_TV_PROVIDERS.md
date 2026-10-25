# Movie, series and drama playback

Filipino movies and series start on **VidRock**, then **2Embed CC**, VidSrc SH,
MultiEmbed, VidLink, VidSrc, VidFast, 2Embed, 2Embed Skin, VidSrc PM, and AutoEmbed.
Tagalog/Filipino language or a Philippine production country selects this order.
Anime keeps its existing provider list even when Philippine locale hints are present.

Other movies, series and dramas keep VidFast first, then VidRock, VidSrc SH,
MultiEmbed, 2Embed CC, VidLink, VidSrc, 2Embed, 2Embed Skin, VidSrc PM, and
AutoEmbed. Eleven servers appear in their Servers menu. Regular anime keeps only
the five shared general hosts, while 18+ / hentai anime gets the same eleven-server
list so it has the same fallback coverage.

Each server receives the same TMDB ID. TV URLs include the selected season and
episode; MultiEmbed additionally requires `tmdb=1` to interpret numeric IDs
correctly. No account, new environment variable or server-side resolver is needed.

Endpoint references:

- [VidRock embedding documentation](https://vidrock.net/)
- [VidSrc SH API documentation](https://vidsrc.sh/vidsrc/docs/)
- [VidLink](https://vidlink.pro/)
- [VidSrc](https://vidsrc.to/)
- [MultiEmbed simple integration](https://www.superembed.stream/)
- [2Embed CC integration](https://www.2embed.cc/#api)

2Embed CC is a separate endpoint from the existing .online and .skin entries.
Its movie route is `/embed/{tmdbId}`; its documented TV route is
`/embedtv/{tmdbId}&s={season}&e={episode}`. Keep the ampersands in the TV path.

VidLink uses `/movie/{tmdbId}` and `/tv/{tmdbId}/{season}/{episode}` and posts
`PLAYER_EVENT` / `MEDIA_DATA` when it resolves a title. VidSrc uses
`/embed/movie/{tmdbId}` and `/embed/tv/{tmdbId}/{season}/{episode}`; its nested
player can require one click before video starts.

When every server fails or reports a catalog miss, the player shows **Where to
watch** (the title’s TMDB watch page) and **Search JustWatch** links. These are
legal availability pointers, not in-app playback.

No embed host carries every title. Gravure, JAV-style, very old, and
region-restricted releases are often absent from all providers. For example,
TMDB 1257095 (*Ai Shinozaki “Love” is overflowing!*) returned a catalog miss or
not-found page from every tested host; it is legally distributed only on
region-locked Japanese services such as U-NEXT, so it cannot be played in-app
through the current provider set.

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
  Its nested video can also require its own Play tap on mobile browsers.
- VidSrc SH played *Heneral Luna*, but the other two samples did not pass the
  same playback check. MultiEmbed, CineSrc, FilmU, Stellar, PrimeSrc, VidPhantom,
  VidLink, Cinezo, VidKing, 111Movies, Rive, VidPlus and Videasy did not pass in
  the tested cases/window. Failures included iframe blocking, inaccessible media
  hosts, catalog misses, and streams stuck at 0:00. They were not added as new
  providers based only on their advertised catalogs.

## Playback investigation — 25 October 2026

Headed Chromium checks inspected real `<video>` duration, ready state, and
advancing time. Results for TMDB 940721 (*Godzilla Minus One*) and TMDB 1399
(*Game of Thrones* S1E1):

- **VidLink** resolved both with feature-length/episode duration and ready state
  4 (movie 02:04:38; episode 01:01:37) after a click. Added as a fallback.
- **VidSrc** played both through its nested `stellarconductornexus.com` player
  with ready state 4 and advancing time. Added as a fallback.
- **VidFast** returned HTTP 403 Cloudflare blocks in headless Chromium but
  loaded a `FETCHING, ONE MOMENT...` shell in headed Chromium; it remains first
  because client-side bot detection is not a reliable signal that real users
  are blocked.
- **VidSrc PM** showed a media element for the movie but no duration/ready state;
  it remains a late fallback.
- **AutoEmbed**, **2Embed CC**, **2Embed**, **2Embed Skin**, **VidSrc SH**, and
  **MultiEmbed** did not expose a verifiable stream in these samples but remain
  as fallbacks from earlier verification.

`vidlink.pro` previously appeared in the retired-provider test; it is re-added
because it now passes the real-playback check. `vixsrc`, `moviesapi`,
`screenscape`, `nontongo`, `superembed`, and `kisskh` remain retired.

Run repeatable, opt-in external playback checks against a running build:

```powershell
$env:CHECK_EXTERNAL_PLAYBACK = '1'
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3101'
npx playwright test e2e/filipino-playback-live.spec.ts
```

These checks visit the real canonical movie pages and require decoded video time
above two seconds with a feature-length duration. They contact external servers
and are skipped in ordinary test runs. Availability can change with time/network.
