import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["firebase-admin"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "media.kitsu.app" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "static.tvmaze.com" },
      { protocol: "https", hostname: "api.tvmaze.com" },
      { protocol: "https", hostname: "archive.org" },
      { protocol: "https", hostname: "ia600200.us.archive.org" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "www.themoviedb.org" },
    ],
  },
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      // Site-wide: reduce ad tech + discourage opener abuse from embeds
      source: "/(.*)",
      headers: [
        {
          key: "Permissions-Policy",
          value:
            "interest-cohort=(), browsing-topics=(), attribution-reporting=(), private-state-token-redemption=(), join-ad-interest-group=(), run-ad-auction=()",
        },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Prevent our pages from being used as ad clickjack shells
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
    },
  ],
};

export default nextConfig;
