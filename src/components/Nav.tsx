"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

const LINK_BASE =
  "inline-flex min-h-11 items-center rounded-md px-2 text-sm transition hover:text-white";

export function Nav() {
  const { t } = useTranslation();
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";
  const isLeaderboard = pathname.startsWith("/leaderboard");

  return (
    <nav aria-label={t("nav.label")} className="flex flex-wrap items-center gap-x-1">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md pr-2 text-base font-bold text-white transition hover:text-purple-200"
      >
        <span aria-hidden="true" className="text-purple-400">
          ★
        </span>
        {t("app.title")}
      </Link>
      <Link
        href="/"
        aria-current={isHome ? "page" : undefined}
        className={`${LINK_BASE} ${isHome ? "font-medium text-white" : "text-gray-300"}`}
      >
        {t("nav.home")}
      </Link>
      <Link
        href="/leaderboard"
        aria-current={isLeaderboard ? "page" : undefined}
        className={`${LINK_BASE} ${isLeaderboard ? "font-medium text-white" : "text-gray-300"}`}
      >
        {t("nav.leaderboard")}
      </Link>
    </nav>
  );
}
