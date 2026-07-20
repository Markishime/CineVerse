export interface ScrollChapter {
  id: string;
  kicker: string;
  title: string;
  body: string;
  video: string;
  poster: string;
  accent: string;
  /** CSS gradient overlay */
  veil: string;
}

export const SCROLL_CHAPTERS: ScrollChapter[] = [
  {
    id: "logo",
    kicker: "01 · Awaken",
    title: "CineVerse emerges from darkness",
    body: "A celestial orbit of stories — movies, series, anime, and K-drama — aligned under one constellation.",
    video: "/scroll/01-awaken.mp4",
    poster: "/scroll/01-awaken.jpg",
    accent: "#A79CFF",
    veil: "from-[#05060A]/95 via-[#05060A]/55 to-[#05060A]/85",
  },
  {
    id: "trending",
    kicker: "02 · Drift",
    title: "Camera through trending frames",
    body: "Poster cards float past like asteroids — ranked by the pulse of the cosmos today.",
    video: "/scroll/02-drift.mp4",
    poster: "/scroll/02-drift.jpg",
    accent: "#31D7F5",
    veil: "from-[#05060A]/90 via-[#080B12]/50 to-[#05060A]/90",
  },
  {
    id: "movies",
    kicker: "03 · Cosmic Premiere",
    title: "Film-frame cinema",
    body: "Wide cinematic cards, projector light, and gold ranks for the silver-screen vault.",
    video: "/scroll/03-movies.mp4",
    poster: "/scroll/03-movies.jpg",
    accent: "#F3C969",
    veil: "from-[#05060A]/92 via-[#12081f]/45 to-[#05060A]/92",
  },
  {
    id: "series",
    kicker: "04 · Infinite Chapters",
    title: "Season timelines unfold",
    body: "Episode arcs and cyan metadata guide the long-form journey.",
    video: "/scroll/04-series.mp4",
    poster: "/scroll/04-series.jpg",
    accent: "#31D7F5",
    veil: "from-[#05060A]/93 via-[#061018]/50 to-[#05060A]/93",
  },
  {
    id: "anime",
    kicker: "05 · Neon Celestial",
    title: "Violet trails and airing clocks",
    body: "English, Romaji, and native titles shimmer along geometric light paths.",
    video: "/scroll/05-anime.mp4",
    poster: "/scroll/05-anime.jpg",
    accent: "#FF5B98",
    veil: "from-[#05060A]/90 via-[#1a0a28]/45 to-[#05060A]/90",
  },
  {
    id: "kdrama",
    kicker: "06 · Seoul After Dark",
    title: "Rain on glass, warm windows",
    body: "Midnight navy and soft city bokeh — drama after the rain.",
    video: "/scroll/06-kdrama.mp4",
    poster: "/scroll/06-kdrama.jpg",
    accent: "#F3C969",
    veil: "from-[#05060A]/92 via-[#1a0c14]/50 to-[#05060A]/92",
  },
  {
    id: "library",
    kicker: "07 · Your orbit",
    title: "Watchlist around your profile",
    body: "Favorites and progress circle you — personal gravity in the CineVerse.",
    video: "/scroll/07-library.mp4",
    poster: "/scroll/07-library.jpg",
    accent: "#F3C969",
    veil: "from-[#05060A]/93 via-[#14100a]/45 to-[#05060A]/93",
  },
  {
    id: "close",
    kicker: "08 · Return",
    title: "Orbit closes into the logo",
    body: "Discover. Track. Watch legally. Never piracy — only verified rights and official trailers.",
    video: "/scroll/08-return.mp4",
    poster: "/scroll/08-return.jpg",
    accent: "#7867FF",
    veil: "from-[#05060A]/95 via-[#0a0618]/55 to-[#05060A]/95",
  },
];
