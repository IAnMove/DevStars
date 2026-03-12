"use client";

import { useTranslation } from "@/lib/i18n";

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
  const { t } = useTranslation();
  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="flex items-center gap-4">
      <img
        src={profile.avatarUrl}
        alt={profile.login}
        className="h-16 w-16 rounded-full border-2 border-gray-700"
      />
      <div>
        <h2 className="text-xl font-bold text-white">
          {profile.name || profile.login}
        </h2>
        <p className="text-sm text-gray-400">@{profile.login}</p>
        {profile.bio && (
          <p className="mt-1 text-sm text-gray-300">{profile.bio}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">{t("results.memberSince")} {memberSince}</p>
      </div>
    </div>
  );
}
