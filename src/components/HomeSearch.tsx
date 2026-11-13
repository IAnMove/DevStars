"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { isValidUsername } from "@/lib/username";
import { PageShell } from "@/components/PageShell";
import { HomeTopFive } from "@/components/HomeTopFive";
import type { HomeTopEntry } from "@/components/HomeTopFive";
import { FOCUS_RING } from "@/lib/ui";

const EXAMPLES = ["torvalds", "gaearon", "IAnMove"] as const;

const INPUT_ID = "github-username";
const HINT_ID = "github-username-hint";
const ERROR_ID = "github-username-error";

// Stored as a code (not as text) so the message follows the language switch
type SearchError = "empty" | "invalid";

/** "  @torvalds " → "torvalds" */
function normalizeLogin(raw: string): string {
  return raw.trim().replace(/^@/, "");
}

export function HomeSearch({
  topEntries,
}: {
  /** Best rows of the ranking, read by the server; null when it could not read them. */
  topEntries: HomeTopEntry[] | null;
}) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<SearchError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { t } = useTranslation();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const login = normalizeLogin(username);
    if (!login) {
      setError("empty");
      inputRef.current?.focus();
      return;
    }
    if (!isValidUsername(login)) {
      setError("invalid");
      inputRef.current?.focus();
      return;
    }
    setError(null);
    router.push(`/user/${encodeURIComponent(login)}`);
  };

  // Brand: first word in white, the rest with the gradient
  const [brandFirst, ...brandRest] = t("app.title").split(" ");

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-xl pt-4 sm:pt-10">
        <div className="text-center">
          <h1 className="mb-2 text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-white">{brandFirst}</span>
            {brandRest.length > 0 && (
              <>
                {" "}
                <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                  {brandRest.join(" ")}
                </span>
              </>
            )}
          </h1>
          <p className="mb-8 text-base text-gray-300 sm:text-lg">
            {t("app.subtitle")}
            <br />
            {t("app.subtitle2")}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate role="search">
          <label htmlFor={INPUT_ID} className="mb-2 block text-sm font-medium text-gray-200">
            {t("search.label")}
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={inputRef}
              id={INPUT_ID}
              name="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              placeholder={t("search.placeholder")}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${HINT_ID} ${ERROR_ID}` : HINT_ID}
              className={`min-h-11 min-w-0 flex-1 rounded-lg border bg-gray-900 px-4 py-3 text-base text-white transition placeholder:text-gray-400 ${
                error ? "border-red-400" : "border-gray-600"
              } ${FOCUS_RING}`}
            />
            <button
              type="submit"
              className={`min-h-11 rounded-lg bg-gradient-to-r from-purple-700 to-pink-700 px-6 py-3 font-semibold text-white transition hover:from-purple-600 hover:to-pink-600 active:scale-95 ${FOCUS_RING}`}
            >
              {t("search.button")}
            </button>
          </div>
          <p id={HINT_ID} className="mt-2 text-xs text-gray-300">
            {t("search.hint")}
          </p>
          {error && (
            <p id={ERROR_ID} role="alert" className="mt-2 text-sm font-medium text-red-300">
              {t(`search.error.${error}`)}
            </p>
          )}
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p id="home-examples-label" className="text-sm text-gray-300">
            {t("home.examples.label")}
          </p>
          <ul aria-labelledby="home-examples-label" className="flex flex-wrap items-center gap-2">
            {EXAMPLES.map((login) => (
              <li key={login}>
                <Link
                  href={`/user/${login}`}
                  prefetch={false}
                  className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-gray-700 bg-gray-900 px-3 text-sm text-gray-200 transition hover:border-purple-400 hover:text-white ${FOCUS_RING}`}
                >
                  @{login}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <HomeTopFive entries={topEntries} />

        <section
          aria-labelledby="home-privacy-title"
          className="mt-12 rounded-lg border border-gray-800 bg-gray-900 px-4 py-4"
        >
          <h2 id="home-privacy-title" className="text-base font-semibold text-white">
            {t("home.privacy.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-300">
            {t("home.privacy.onTheFly")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-300">
            {t("home.privacy.saved", { button: t("leaderboard.save") })}
          </p>
        </section>
      </div>
    </PageShell>
  );
}
