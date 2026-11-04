import type { Metadata } from "next";

// Owner-only sign-in. Not linked anywhere and kept out of search results.
export const metadata: Metadata = {
  title: "Owner sign-in",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
