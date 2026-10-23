import Link from "next/link";

export default function LeaderboardPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-gray-400 transition hover:text-white">
          Home
        </Link>
      </nav>
      <h1 className="mb-2 text-3xl font-bold">
        <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          Leaderboard
        </span>
      </h1>
      <p className="max-w-2xl text-sm text-gray-400">
        GitHub leaderboard of top developers ranked by public activity: commits,
        pull requests, reviews and consistency. Compare GitHub Stars scores.
      </p>
    </main>
  );
}
