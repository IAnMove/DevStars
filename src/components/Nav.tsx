"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { FOCUS_RING } from "@/lib/ui";

// Compact below `sm` so brand + links + language switch share one row at
// 412 px; targets stay at 44 px (min-h-11 / min-w-11).
const LINK_BASE = `inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-md px-1 text-[13px] transition hover:text-white sm:px-2 sm:text-sm ${FOCUS_RING}`;

const LINK_CURRENT =
  "font-medium text-white underline decoration-purple-400 decoration-2 underline-offset-8";
const LINK_OTHER = "text-gray-300";

export function Nav() {
  const { t } = useTranslation();
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";
  const isLeaderboard = pathname.startsWith("/leaderboard");

  return (
    <nav aria-label={t("nav.label")} className="flex min-w-0 flex-wrap items-center sm:gap-x-1">
      <Link
        href="/"
        className={`inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-md pr-1 text-sm font-bold text-white transition hover:text-purple-200 sm:gap-1.5 sm:pr-2 sm:text-base ${FOCUS_RING}`}
      >
        <span aria-hidden="true" className="text-purple-400">
          ★
        </span>
        {t("app.title")}
      </Link>
      <Link
        href="/"
        aria-current={isHome ? "page" : undefined}
        className={`${LINK_BASE} ${isHome ? LINK_CURRENT : LINK_OTHER}`}
      >
        {t("nav.home")}
      </Link>
      <Link
        href="/leaderboard"
        aria-current={isLeaderboard ? "page" : undefined}
        className={`${LINK_BASE} ${isLeaderboard ? LINK_CURRENT : LINK_OTHER}`}
      >
        {t("nav.leaderboard")}
      </Link>
    </nav>
  );
}
