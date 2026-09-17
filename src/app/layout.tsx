import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/components/providers/app-providers";
import { AppChrome } from "@/components/layout/app-chrome";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CineVerse — Discover Movies, Series, Anime & K-Drama",
    template: "%s · CineVerse",
  },
  description:
    "Premium entertainment discovery and tracking for movies, series, anime, and K-dramas. Watchlists, progress, legal providers, and personalized recommendations.",
  applicationName: "CineVerse",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CineVerse",
  },
  openGraph: {
    type: "website",
    siteName: "CineVerse",
    title: "CineVerse",
    description:
      "Premium entertainment discovery across movies, series, anime, and K-drama.",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark"
    >
      <body className="min-h-dvh bg-[var(--background)] font-sans antialiased">
        <AppProviders>
          <AppChrome>{children}</AppChrome>
          <RegisterServiceWorker />
        </AppProviders>
      </body>
    </html>
  );
}
