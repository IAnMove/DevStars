"use client";

import { useTranslation } from "@/lib/i18n";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="mt-8 border-t border-gray-800 py-4 text-center text-xs text-gray-500">
      <a
        href="https://github.com/IAnMove/DevStars"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-purple-400 transition"
      >
        {t("footer.source")}
      </a>
    </footer>
  );
}
