# Movie, series and drama playback

VidFast remains the default. The fallback order is VidRock, VidSrc SH,
MultiEmbed, 2Embed, 2Embed Skin, VidSrc PM, then AutoEmbed. All eight appear in
the Servers menu for movies, Filipino movies, series and Korean, Chinese,
Japanese and Thai dramas. The additional providers are excluded from anime.

Each server receives the same TMDB ID. TV URLs include the selected season and
episode; MultiEmbed additionally requires `tmdb=1` to interpret numeric IDs
correctly. No account, new environment variable or server-side resolver is needed.

Endpoint references:

- [VidRock embedding documentation](https://vidrock.net/)
- [VidSrc SH API documentation](https://vidsrc.sh/vidsrc/docs/)
- [MultiEmbed simple integration](https://www.superembed.stream/)

Use **Servers** to pick an alternative, or **Next server** when a host loads but
has no playable stream. Explicit player errors and frame load failures advance
automatically. A silent iframe alone does not prove a title is unavailable, so
the player retains hosts that need a user click to start.

Provider catalogs vary by title and region. HTTP responses and routing tests
verify integration, not availability of every movie or actual video playback.
