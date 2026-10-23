import type { Metadata } from "next";

const title = "GitHub Leaderboard: Top Developers by Activity | GitHub Stars";
const description =
  "GitHub leaderboard of top developers ranked by public activity: commits, pull requests, reviews and consistency. Compare GitHub Stars scores.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "GitHub leaderboard",
    "GitHub stars",
    "top GitHub developers",
    "GitHub activity ranking",
    "developer score",
    "open source leaderboard",
  ],
  alternates: {
    canonical: "/leaderboard",
  },
  openGraph: {
    title,
    description,
    url: "/leaderboard",
    siteName: "GitHub Dev Evaluator",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
