"use client";

import { useTranslation } from "@/lib/i18n";
import { localeFor, sizedAvatarUrl } from "@/lib/format";

const AVATAR_CSS_SIZE = 64;

export function ProfileHeader({
  profile,
}: {
  profile: {
    login: string;
    name: string | null;
    avatarUrl: string;
    bio: string | null;
    createdAt: Date | string;
  };
}) {
  const { t, language } = useTranslation();
  const created = new Date(profile.createdAt);
  const hasDate = !Number.isNaN(created.getTime());
  const memberSince = hasDate
    ? new Intl.DateTimeFormat(localeFor(language), { year: "numeric", month: "long" }).format(created)
    : null;

  return (
    <div className="flex min-w-0 items-start gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sizedAvatarUrl(profile.avatarUrl, AVATAR_CSS_SIZE * 2)}
        alt={t("profile.avatarAlt", { username: profile.login })}
        width={AVATAR_CSS_SIZE}
        height={AVATAR_CSS_SIZE}
        decoding="async"
        className="h-16 w-16 shrink-0 rounded-full border-2 border-gray-700 bg-gray-800"
      />
      <div className="min-w-0">
        <h1 className="break-words text-xl font-bold text-white sm:text-2xl">
          {profile.name || profile.login}
        </h1>
        <a
          href={`https://github.com/${encodeURIComponent(profile.login)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-purple-300 underline underline-offset-2 transition hover:text-purple-200"
        >
          <span>@{profile.login}</span>
          <span aria-hidden="true" className="text-xs">
            GitHub ↗
          </span>
          <span className="sr-only">{t("profile.githubLink")}</span>
        </a>
        {profile.bio && <p className="break-words text-sm text-gray-300">{profile.bio}</p>}
        {memberSince && (
          <p className="mt-1 text-xs text-gray-400">
            {t("results.memberSince")}{" "}
            <time dateTime={created.toISOString()}>{memberSince}</time>
          </p>
        )}
      </div>
    </div>
  );
}
