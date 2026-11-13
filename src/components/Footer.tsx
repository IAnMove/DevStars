"use client";

import { useTranslation } from "@/lib/i18n";
import { REPO_URL } from "@/lib/site";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-2 border-t border-gray-800 pt-2 text-xs text-gray-400">
      <span>{t("app.title")}</span>
      <span aria-hidden="true">·</span>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center rounded-md px-2 text-gray-300 underline underline-offset-2 transition hover:text-purple-300"
      >
        {t("footer.source")}
      </a>
    </footer>
  );
}
