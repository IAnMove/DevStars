"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function Nav() {
  const { t } = useTranslation();

  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/" className="text-gray-400 transition hover:text-white">
        {t("nav.home")}
      </Link>
      <Link href="/leaderboard" className="text-gray-400 transition hover:text-white">
        {t("nav.leaderboard")}
      </Link>
    </nav>
  );
}
